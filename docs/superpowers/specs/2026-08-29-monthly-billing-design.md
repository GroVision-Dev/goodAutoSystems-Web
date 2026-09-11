# 월 결제(청구서) 시스템 설계

## 목적
관리자가 회원별로 월 결제 금액을 설정하고, 회원이 마이페이지에서 해당 월 청구서를 확인·결제하는 기능.
청구서는 **관리자 수동 발행**만 지원한다(자동 생성·크론 없음).

## 데이터 모델
- `User.monthlyAmount Int?`, `User.monthlyTitle String?`, `User.billingDay Int?(1~31)` — 회원별 월 결제 설정. 일괄 발행 시 기본값으로 사용.
- `Invoice` — 청구서. `userId`, `billingMonth("YYYY-MM")`, `title`, `amount`, `memo?`, `status(UNPAID|PAID|CANCELED)`, `dueDate?`, `notifiedAt?`, `paidAt?`.
  `@@unique([userId, billingMonth])` — 회원당 한 달에 한 장.
  `dueDate`는 청구 월 + 회원 결제일로 계산(그 달에 없는 날짜는 말일). `notifiedAt`은 안내 문자 마지막 발송 시각.

## 월 결제 상품 (2026-09-11 추가)
- `Product.billingType(ONE_TIME|MONTHLY)`, `minMonths?`, `maxMonths?`. MONTHLY의 `price`는 1개월 이용료.
- AI 스타터(월 49만원, 1~2개월)·엔터프라이즈(월 190만원, 1~3개월)는 MONTHLY. 시드가 기존 DB의 ONE_TIME 행을 1회 전환한다.
- 구매 흐름: 상품 주문으로 **첫 달 이용료**만 결제 → 결제 완료 시 `setupMonthlyBillingAfterPurchase`가
  (1) 회원 월 결제 설정이 없으면 금액·항목(상품명)·결제일(결제한 날짜)을 등록하고
  (2) 이번 달 청구서를 PAID로 만들어 주문에 연결한다(같은 달 중복 청구 방지).
  다음 달부터는 관리자가 월결제 관리에서 청구서를 발행한다. 계약 종료 시 관리자가 회원의 월 결제 설정을 해제한다.
- MONTHLY 상품은 재구매(첫 달 결제 재시작)를 막지 않는다. ONE_TIME만 중복 구매 차단.

## 결제일·문자 안내 (2026-09-10 추가)
- 회원마다 결제일이 달라서 관리자가 회원관리에서 결제일(매월 N일)을 등록한다.
- 월결제 관리 상단에 "이번 달 결제 예정 회원"을 결제일순으로 보여주고(D-day, 미발행/미납/납부 상태), 행에서 바로 "발행 + 문자" / "발행만" 할 수 있다.
- 청구서 발행(개별·일괄·예정 목록)에 문자 발송 옵션이 있다. SOLAPI로 회원 휴대폰에 청구 월·항목·금액·결제일·마이페이지 링크를 보낸다. SOLAPI 미설정(로컬)이면 콘솔 출력만 하고 `notifiedAt`은 기록하지 않는다.
- 미납 청구서는 "문자 재발송"이 가능하고, 결제일이 지난 미납은 관리자·마이페이지 양쪽에 연체로 표시한다.
- `Order.productId`를 선택으로 변경, `Order.invoiceId?` 추가. 상품 주문과 청구서 결제가 같은 결제 승인·취소·금액 검증 흐름을 공유한다.

## 관리자
- 사이드 메뉴 **월결제 관리** `/admin/billing`
  - 청구서 목록(월·상태·회원 검색), 미납 청구서 취소
  - 개별 발행 폼(회원 선택, 청구 월, 항목명, 금액, 메모)
  - "N월 청구서 일괄 생성": `monthlyAmount > 0`인 활성 회원 중 해당 월 청구서가 없는 회원에게 생성
- 회원관리 행에 **월결제 설정**(금액·항목명) 인라인 폼

## 회원
- 마이페이지 **월 결제** 섹션: 청구서 목록(월·항목·금액·상태·납부일), 미납 건 "결제하기"
- `/checkout/invoice/[id]` — 기존 토스 위젯 컴포넌트 재사용. `POST /api/orders {invoiceId}`로 PENDING 주문 생성 후 `/checkout/success`에서 승인 → `Order.PAID` + `Invoice.PAID`.
- 관리자가 결제 취소(환불)하면 `Invoice`는 `UNPAID`로 되돌린다.

## 검증
- 금액은 항상 서버의 `Invoice.amount`로 확정. 본인 청구서만 결제 가능. 이미 PAID/CANCELED면 결제 불가.
