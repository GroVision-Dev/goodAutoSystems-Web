# 단건 결제 요청(비회원 결제) 설계

- 작성일: 2026-09-15
- 상태: 승인됨 (채팅에서 설계 승인)

## 목적

관리자가 회원가입하지 않은 고객에게 **항목명·금액을 직접 입력한 결제 요청**을 문자(SOLAPI)로 보내고,
고객은 로그인 없이 링크에서 포트원(PortOne V2, KG이니시스) 카드 결제를 한다.
용역·견적처럼 상품 목록에 없는 금액을 받는 용도다.

## 결정 사항

| 항목 | 결정 |
|---|---|
| 결제 항목 | 관리자가 항목명·금액·메모를 직접 입력 (상품과 무관) |
| 링크 보안 | 추측 불가능한 토큰(256비트) 링크 + 유효기간 + 이름 일부 마스킹. 추가 본인확인 없음 |
| 결제 처리 | 기존 `Order` + `syncPaymentFromPortOne` + 포트원 웹훅 재사용 (별도 결제 로직을 만들지 않음) |
| 구매자 이메일 | 이니시스 V2 필수 항목이라 결제 페이지에서 입력받음 |
| 유효기간 | 기본 7일, 관리자가 1~30일 지정 |
| 범위 제외 | 휴대폰 뒷자리/문자 본인확인, 분할 결제, 카드 외 결제수단, 결제 완료 관리자 알림 문자 |

## 데이터 모델

### 신규 `PaymentRequest`

| 필드 | 타입 | 설명 |
|---|---|---|
| id | String cuid | |
| token | String @unique | `randomBytes(32)` base64url. 결제 링크 `/pay/{token}` |
| title | String | 항목명 (1~60자) |
| amount | Int | 100 ~ 100,000,000원 |
| memo | String? | 고객에게 표시되는 메모 (200자) |
| recipientName | String | 받는 분 이름 (2~40자) |
| recipientPhone | String | 숫자만 010XXXXXXXX |
| customerEmail | String? | 결제 시 고객이 입력한 이메일 (최근 값) |
| status | PaymentRequestStatus | PENDING / PAID / CANCELED / EXPIRED / REFUNDED |
| expiresAt | DateTime | 유효기간 |
| createdById / createdByUsername | String | 요청한 관리자 (탈퇴·아이디 변경과 무관하게 스냅샷) |
| notifiedAt | DateTime? | 마지막 문자 발송 시각 |
| sentCount | Int @default(0) | 문자 발송 횟수 |
| paidAt / canceledAt | DateTime? | |
| createdAt / updatedAt | DateTime | |
| orders | Order[] | |

인덱스: `[status, createdAt]`, `[recipientPhone]`.

### `Order` 변경

- `userId String?` (비회원 결제는 null), `user User?`
- `paymentRequestId String?` + relation `paymentRequest PaymentRequest?`
- 컬럼 추가·NULL 허용 변경뿐이라 `prisma db push`로 데이터 손실 없이 반영된다.

회원 ID를 전제로 하던 곳(관리자 주문내역·대시보드의 `order.user.name`, 결제 동기화의 1회 상품 중복 검사)은 null을 처리한다.
회원 전용 흐름(마이페이지, 다운로드, 프로그램 사용권, 월 결제 설정)은 `userId` 조건으로 조회하므로 영향이 없다.

## 구성 요소

### `lib/payment-request.ts` (순수 함수, 단위 테스트 대상)
- `generatePaymentRequestToken()` — 32바이트 base64url
- `maskName(name)` — "홍길동" → "홍*동", "김철" → "김*", 1자는 그대로
- `paymentRequestSmsText({ recipientName, title, amount, url })` — `[Optix] {이름}님 결제 요청: {항목} {금액}원 {url}`
- `paymentRequestCreateSchema` (zod) — 이름·휴대폰·항목·금액·메모·유효기간(1~30일)
- `paymentRequestView(request, now)` — 화면 상태 계산: `payable` / `paid` / `canceled` / `expired` / `refunded`
- 상수: `PAYMENT_REQUEST_DEFAULT_DAYS = 7`, `PAYMENT_REQUEST_MAX_DAYS = 30`

### 관리자 `app/optix-dev/payment-requests/`
- `page.tsx` — `requireAdminPage()` + `logAdminView(ADMIN_VIEW_PAYMENT_REQUESTS)`. 생성 폼 + 목록(최근 200건, 상태·검색 필터)
- `actions.ts` — 모든 액션 첫 줄 `requireAdmin()`
  - `createPaymentRequest` — 검증 → 생성 → (notify면) 문자 발송 → 감사 로그 `ADMIN_PAYMENT_REQUEST_CREATED`
  - `resendPaymentRequest` — PENDING이고 유효기간 내일 때만, 요청당 10분 1회 제한 → `ADMIN_PAYMENT_REQUEST_SENT`
  - `cancelPaymentRequest` — PENDING/EXPIRED만 CANCELED → `ADMIN_PAYMENT_REQUEST_CANCELED`
- `components/admin-payment-request-form.tsx`, 목록 행 버튼 컴포넌트
- `components/admin-nav.tsx`에 "단건 결제" 메뉴

SOLAPI 미설정 시 기존 청구서 문자와 같이 서버 콘솔 출력 후 "문자 미설정" 안내.

### 고객 결제 페이지 `app/pay/[token]/`
- `page.tsx` — 로그인 불필요. 토큰 형식 검증 후 조회, IP당 10분 60회 조회 제한(초과 시 안내 화면).
  - 결제 가능: 사업자 정보, 받는 분(마스킹), 항목·금액·메모·유효기간, 환불·증빙 안내, 이메일 입력, 필수 동의 체크, 결제 버튼
  - 그 외 상태: 결제 완료 / 취소 / 만료 / 환불 안내만
  - 없는 토큰: 404와 같은 일반 안내 (존재 여부를 구분하지 않음)
- `complete/page.tsx` — `?paymentId=`의 주문이 이 토큰의 요청 주문인지 확인 후 `syncPaymentFromPortOne(orderId, { source: "success_page" })`. 실패 코드(`code`)면 PENDING 주문만 FAILED
- `components/payment-request-checkout.tsx` — 이메일·동의 입력 → 주문 API → `PortOne.requestPayment`(payMethod CARD, redirectUrl `/pay/{token}/complete`)
- `layout.tsx`/metadata — `robots: noindex, nofollow`

### 주문 API `app/api/pay/[token]/order/route.ts`
- POST `{ email, agree }` — IP당 10분 20회, 토큰당 10분 10회 제한
- 요청 조회 → 상태 PENDING이고 `expiresAt > now`가 아니면 409
- `expireStalePendingOrders()` 호출 후 `Order { userId: null, paymentRequestId, amount: request.amount, status: PENDING }` 생성
- 요청의 `customerEmail` 갱신
- 응답: `orderId, amount, orderName(title), customerName, customerPhone, customerEmail`

## 결제 동기화 규칙 (`lib/payment-sync.ts` 확장)

- PAID 전환 트랜잭션 안에서, 주문에 `paymentRequestId`가 있으면
  `paymentRequest.updateMany({ where: { id, status: { in: ["PENDING", "EXPIRED"] } }, data: { status: "PAID", paidAt } })`.
  count가 0이면(이미 결제·취소·환불된 요청) `DuplicatePaymentError("payment_request")` → 자동 환불.
- 1회 결제 상품 중복 검사는 `userId`가 있을 때만 수행.
- 포트원 취소(CANCELLED) 동기화: 결제 요청 주문이면 요청을 REFUNDED로.
- 관리자 결제취소(`cancelOrder`): 결제 요청 주문이면 요청을 REFUNDED로.
- 유효기간이 지난 요청이라도 결제창이 열린 상태에서 결제가 들어오면 정상 결제로 인정한다 (EXPIRED → PAID).

## 정기 작업
`lib/maintenance.ts`의 주문 만료 주기(10분)에 `expireStalePaymentRequests()` 추가 — PENDING이고 `expiresAt <= now`인 요청을 EXPIRED로.

## 보안·개인정보
- 토큰 256비트, 형식 검증(`^[A-Za-z0-9_-]{43}$`), 존재하지 않는 토큰과 형식 오류를 같은 화면으로 처리
- `/pay/:path*` 응답 `Cache-Control: no-store`, `robots.txt`에 `/pay/` 제외
- 결제 금액은 항상 DB의 요청 금액으로 확정, 포트원 조회로 재검증 (기존 규칙)
- 감사 로그: 생성·발송·취소·목록 열람 (`AUDIT_ACTIONS`에 추가)
- 개인정보처리방침: "비회원 결제 요청" 수집 항목(이름·휴대폰·이메일), 목적(결제 요청 안내·결제 처리), 보유기간(전자상거래법에 따라 5년), 처리위탁(포트원·PG, 솔라피)
- 결제 페이지 필수 동의: 개인정보 수집·이용 및 결제대행사 제공

## 화면 표기
- 관리자 주문내역·대시보드: 비회원 주문은 "비회원 · {받는 분 이름}", 상품 칸은 `[단건] {항목명}`
- 주문 검색에 받는 분 이름·항목명 포함

## 오류 처리
- 문자 발송 실패: 요청은 생성하고 관리자 화면에 "문자 발송 실패: 사유" 표시, 재발송 가능
- 포트원 조회 일시 오류: 완료 페이지에 "결제 확인 지연" 안내, 웹훅이 재시도로 반영
- 요청 제한 초과: 429 / 안내 화면

## 테스트
- 단위 테스트 `lib/payment-request.test.ts`: 토큰 형식·유일성, 마스킹, 문자 문구, 생성 스키마(금액·기간·휴대폰), 상태 계산(만료 경계 포함)
- 로컬 실행 확인: 관리자 요청 생성 → 결제 페이지 상태별 화면 → 주문 API(정상 생성·금액 확정·만료/취소 거부·요청 제한) → 없는 토큰 처리
- `npx tsc --noEmit`, `npm run lint`, `npm run build`, `npm test`
