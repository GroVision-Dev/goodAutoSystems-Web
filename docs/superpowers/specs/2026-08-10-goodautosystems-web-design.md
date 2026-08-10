# 굿오토시스템즈 웹사이트 설계서

날짜: 2026-08-10
상태: 확정 (사용자 지시: 추천안으로 전체 진행)

## 1. 개요

굿오토시스템즈의 공식 홈페이지 겸 판매 사이트.

- 회사/제품 소개 (랜딩 페이지, 더미 영상 히어로)
- 상품 판매: 데스크톱 프로그램 + AI 자동화 서비스 상품
- 회원 가입/로그인, 마이페이지 (구매내역, 프로그램 다운로드)
- 토스페이먼츠 PG 연동 (단건 결제, 테스트 키)
- 데스크톱 프로그램용 인증 API (웹 계정으로 프로그램 로그인)
- 기본 어드민 (회원관리, 상품관리, 주문조회)
- 디자인: 다크 네이비 테마

## 2. 기술 스택

| 영역 | 선택 |
|------|------|
| 프레임워크 | Next.js 15 (App Router, TypeScript) |
| 스타일 | Tailwind CSS v4, 다크 네이비 커스텀 팔레트 |
| DB / ORM | SQLite + Prisma (운영 전환 시 PostgreSQL로 스키마 재사용) |
| 웹 인증 | Auth.js(NextAuth v5) Credentials — 이메일+비밀번호, bcrypt 해시, JWT 세션 |
| 프로그램 인증 | 자체 JWT 발급 API (`jose` 라이브러리) |
| 결제 | 토스페이먼츠 결제위젯 v2 (`@tosspayments/tosspayments-sdk`), 테스트 키 |
| 검증 | Zod (API 입력 검증) |

## 3. 페이지 구조

### 공개 페이지
- `/` — 랜딩: 더미 영상 히어로(회사/제품 소개 영상 자리), 회사 소개 섹션, 대표 상품 하이라이트, CTA
- `/products` — 상품 목록 (프로그램 / AI 자동화 서비스)
- `/products/[id]` — 상품 상세 + 구매 버튼 (비로그인 시 로그인 유도)
- `/services` — AI 자동화 업무 지원 서비스 소개
- `/about` — 회사 소개
- `/login`, `/register` — 로그인 / 회원가입

### 회원 페이지 (로그인 필요)
- `/mypage` — 내 정보, 구매 내역, 구매한 프로그램 다운로드 버튼
- `/checkout/[productId]` — 토스 결제위젯 결제 페이지
- `/checkout/success`, `/checkout/fail` — 결제 결과 처리

### 어드민 (role=ADMIN)
- `/admin` — 대시보드 (요약 수치)
- `/admin/users` — 회원 목록, 활성/정지 상태 관리
- `/admin/products` — 상품 등록/수정/노출 관리
- `/admin/orders` — 주문/결제 내역 조회

## 4. 데이터 모델 (Prisma)

```
User    : id, email(unique), passwordHash, name, role(USER|ADMIN), status(ACTIVE|SUSPENDED), createdAt
Product : id, name, slug, summary, description, price, category(PROGRAM|AI_SERVICE),
          downloadFile?(프로그램일 때), isActive, createdAt
Order   : id, userId, productId, orderId(토스 주문번호, unique), amount,
          status(PENDING|PAID|FAILED|CANCELED), paymentKey?, method?, paidAt?, createdAt
```

- 사용권(라이선스)은 별도 테이블 없이 "status=PAID인 Order 존재 여부"로 판정 (YAGNI).

## 5. 인증 설계

### 웹 (Auth.js Credentials)
- 회원가입: `/api/auth/register` — Zod 검증, bcrypt 해시 저장
- 로그인: Auth.js signIn, JWT 세션 쿠키
- 미들웨어로 `/mypage`, `/checkout`, `/admin` 보호. `/admin`은 role 검사 추가.

### 데스크톱 프로그램용 API
- `POST /api/program/login` — email+password → access token(JWT, 7일) 발급
- `GET  /api/program/me` — 토큰으로 내 정보 조회
- `GET  /api/program/license?product=<slug>` — 해당 프로그램 구매(PAID) 여부 반환.
  프로그램은 시작 시 이 API로 사용권 확인.
- 계정 status=SUSPENDED면 로그인/라이선스 모두 거부.

### 다운로드
- `GET /api/download/[productId]` — 웹 세션 로그인 + 해당 상품 PAID 주문 확인 후 파일 응답 (더미 zip 파일).

## 6. 결제 흐름 (토스페이먼츠 단건 결제)

1. `/checkout/[productId]` 진입 → 서버 액션으로 PENDING Order 생성 (금액은 서버의 상품 가격 사용, orderId는 서버 생성)
2. 결제위젯 렌더 (테스트 클라이언트 키) → 사용자가 결제 수단 선택 후 결제 요청
3. successUrl(`/checkout/success?paymentKey&orderId&amount`)에서 서버가:
   - DB의 Order 금액과 쿼리 amount 일치 검증 (금액 위변조 방지)
   - 토스 `POST /v1/payments/confirm` 호출 (시크릿 키, Basic 인증)
   - 성공 시 Order → PAID, paymentKey/method/paidAt 저장
4. 실패 시 failUrl(`/checkout/fail`)에서 Order → FAILED 처리 및 안내
- 키는 `.env` 관리: 토스 공개 테스트 키(`test_gck_docs...` 문서용 키)로 초기 세팅, 실키 교체만 하면 운영 전환.
- 웹훅은 도입하지 않음 (단건 결제 + confirm 방식으로 충분).

## 7. 디자인

- 다크 네이비 팔레트: 배경 `#0A0F1E`, 서피스 `#111A2E`/`#16213B`, 보더 `#233252`,
  포인트 블루 `#3B82F6`, 보조 시안 `#22D3EE`, 텍스트 `#E2E8F0`/`#94A3B8`
- 폰트: Pretendard (CDN)
- 랜딩 히어로: `<video>` 태그 + 로컬 더미 mp4(생성 가능 시) 또는 애니메이션 그라데이션 포스터.
  실제 소개 영상 파일로 교체만 하면 되는 구조.
- 전 페이지 반응형.

## 8. 검증 계획

- `npm run build` 통과 (타입/린트 포함)
- 시드 데이터: 어드민 계정, 일반 회원 1명, 상품 3개(프로그램 1, AI 서비스 2)
- API 스모크 테스트: 회원가입 → 프로그램 로그인 → 라이선스 조회(false) → (테스트용 PAID 주문 생성) → 라이선스 조회(true) → 다운로드
- 결제: 토스 테스트 키로 결제위젯 렌더 및 confirm 흐름 확인 (테스트 환경에서 실제 승인 시도)
- 브라우저에서 전 페이지 육안 확인 (다크 네이비 테마, 반응형)

## 9. 범위 제외 (YAGNI)

- 구독/자동결제(빌링), 환불 자동화, 이메일 인증/비밀번호 재설정, 소셜 로그인,
  공지사항/게시판, 다국어 — 필요 시 후속 단계에서 추가.
