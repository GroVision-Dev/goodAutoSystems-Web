# 굿오토시스템즈 웹사이트 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 회원/로그인/상품판매/토스페이먼츠 결제/프로그램 인증 API/어드민을 갖춘 다크 네이비 테마의 굿오토시스템즈 공식 웹사이트 구축.

**Architecture:** Next.js 15 App Router 풀스택 단일 프로젝트. Prisma+SQLite로 User/Product/Order 관리, Auth.js Credentials로 웹 세션, `jose` JWT로 데스크톱 프로그램 인증 API 제공. 토스페이먼츠 결제위젯 v2 + 서버측 confirm으로 단건 결제.

**Tech Stack:** Next.js 15 (TypeScript), Tailwind CSS v4, Prisma + SQLite, Auth.js(next-auth v5 beta), jose, bcryptjs, zod, @tosspayments/tosspayments-sdk

## Global Constraints

- 디자인: 다크 네이비 팔레트 — 배경 `#0A0F1E`, 서피스 `#111A2E`/`#16213B`, 보더 `#233252`, 포인트 `#3B82F6`, 보조 `#22D3EE`, 텍스트 `#E2E8F0`/`#94A3B8`
- 폰트: Pretendard CDN
- 모든 API 입력은 zod 검증, 비밀번호는 bcrypt 해시
- 결제 금액은 항상 서버 DB 기준으로 검증 (클라이언트 금액 신뢰 금지)
- 토스 키는 `.env` 관리, 문서용 테스트 키로 초기 세팅
- 회사명: 굿오토시스템즈 (Good Auto Systems)
- 각 태스크 완료 시 `npm run build` 또는 dev 서버로 동작 확인 후 커밋

---

### Task 1: 프로젝트 스캐폴딩 + 다크 네이비 테마 기반

**Files:**
- Create: Next.js 프로젝트 전체 (create-next-app, TypeScript+Tailwind+App Router, src 디렉토리 사용 안 함, `app/` 루트)
- Modify: `app/globals.css` (팔레트 CSS 변수), `app/layout.tsx` (Pretendard, 메타데이터, Header/Footer)
- Create: `components/site-header.tsx`, `components/site-footer.tsx`

**Interfaces:**
- Produces: 전역 CSS 변수 `--background`, `--surface`, `--surface-2`, `--border`, `--accent`, `--accent-2`, `--foreground`, `--muted`. 헤더 네비: 홈/상품/서비스/회사소개 + 로그인/마이페이지.

**Steps:**
- [ ] create-next-app 실행 (현재 레포 루트에 생성)
- [ ] globals.css에 다크 네이비 팔레트 정의, Tailwind v4 `@theme inline` 매핑
- [ ] layout.tsx: Pretendard CDN, `<html lang="ko">`, Header/Footer 배치
- [ ] Header: 로고(텍스트), 네비게이션, 로그인 버튼 자리
- [ ] `npm run build` 통과 확인 후 커밋

### Task 2: Prisma 스키마 + 시드

**Files:**
- Create: `prisma/schema.prisma`, `prisma/seed.ts`, `lib/prisma.ts`
- Modify: `package.json` (seed 스크립트), `.env` (`DATABASE_URL="file:./dev.db"`)

**Interfaces:**
- Produces:
```prisma
enum Role { USER ADMIN }
enum UserStatus { ACTIVE SUSPENDED }
enum Category { PROGRAM AI_SERVICE }
enum OrderStatus { PENDING PAID FAILED CANCELED }

model User { id String @id @default(cuid()); email String @unique; passwordHash String;
  name String; role Role @default(USER); status UserStatus @default(ACTIVE);
  createdAt DateTime @default(now()); orders Order[] }
model Product { id String @id @default(cuid()); name String; slug String @unique;
  summary String; description String; price Int; category Category;
  downloadFile String?; isActive Boolean @default(true);
  createdAt DateTime @default(now()); orders Order[] }
model Order { id String @id @default(cuid()); userId String; productId String;
  orderId String @unique; amount Int; status OrderStatus @default(PENDING);
  paymentKey String?; method String?; paidAt DateTime?;
  createdAt DateTime @default(now());
  user User @relation(fields:[userId], references:[id]);
  product Product @relation(fields:[productId], references:[id]) }
```
- `lib/prisma.ts`: 글로벌 싱글턴 `export const prisma`

**Steps:**
- [ ] prisma 설치, 스키마 작성, `prisma db push`
- [ ] seed: 어드민(admin@goodautosystems.com / admin1234!), 회원(user@test.com / test1234!), 상품 3개 — GoodAuto Pro(프로그램, 99,000원, downloadFile 있음), AI 업무 자동화 스타터(490,000원), AI 업무 자동화 엔터프라이즈(1,900,000원)
- [ ] `npx prisma db seed` 실행 확인, 커밋 (dev.db는 .gitignore)

### Task 3: 인증 — 회원가입 + Auth.js 로그인

**Files:**
- Create: `auth.ts`(루트), `app/api/auth/[...nextauth]/route.ts`, `app/api/auth/register/route.ts`, `lib/validators.ts`, `middleware.ts`
- Create: `app/(auth)/login/page.tsx`, `app/(auth)/register/page.tsx`, `components/auth-forms.tsx`

**Interfaces:**
- Produces: `auth()` 세션 헬퍼 (session.user.id, role 포함), `signIn`/`signOut`. `POST /api/auth/register {email,password,name}` → 201. middleware: `/mypage`, `/checkout`, `/admin` 보호, `/admin`은 role=ADMIN.
- 세션 JWT 콜백에서 id/role 주입:
```ts
callbacks: {
  jwt({token, user}) { if (user) { token.id = user.id; token.role = (user as any).role } return token },
  session({session, token}) { session.user.id = token.id as string; (session.user as any).role = token.role; return session }
}
```

**Steps:**
- [ ] next-auth@beta, bcryptjs, zod 설치. auth.ts Credentials provider (email/password 검증, SUSPENDED 거부)
- [ ] register API: zod 검증(이메일 형식, 비번 8자+), 중복 이메일 409
- [ ] 로그인/회원가입 페이지 (다크 네이비 폼)
- [ ] Header에 세션 상태 반영 (로그인/로그아웃/마이페이지)
- [ ] 수동 검증: 가입 → 로그인 → /mypage 접근, 비로그인 시 redirect. 커밋

### Task 4: 공개 페이지 — 랜딩/상품/서비스/회사소개

**Files:**
- Create: `app/page.tsx`(랜딩), `app/products/page.tsx`, `app/products/[slug]/page.tsx`, `app/services/page.tsx`, `app/about/page.tsx`
- Create: `public/videos/intro-placeholder.mp4` (더미 영상 — ffmpeg 가능 시 생성, 불가 시 애니메이션 그라데이션 + poster 대체), `components/hero-video.tsx`, `components/product-card.tsx`

**Interfaces:**
- Consumes: prisma Product 조회
- Produces: 상품 상세의 "구매하기" → `/checkout/[slug]` 링크 (비로그인 시 /login?callbackUrl=)

**Steps:**
- [ ] 랜딩: 풀스크린 영상 히어로(자동재생 muted loop, 실영상 교체 안내 주석), 회사 소개, 상품 하이라이트 3종, CTA
- [ ] 상품 목록/상세 (DB 조회, 가격 콤마 표시, 카테고리 뱃지)
- [ ] 서비스/회사소개 페이지 (AI 자동화 서비스 설명, 회사 정보)
- [ ] 반응형 확인, 빌드 통과, 커밋

### Task 5: 토스페이먼츠 결제

**Files:**
- Create: `app/checkout/[slug]/page.tsx`, `components/toss-checkout.tsx`(클라이언트, 위젯), `app/api/orders/route.ts`(POST: PENDING 주문 생성), `app/checkout/success/page.tsx`, `app/checkout/fail/page.tsx`, `lib/toss.ts`(confirm 호출)
- Modify: `.env` — `NEXT_PUBLIC_TOSS_CLIENT_KEY=test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm`, `TOSS_SECRET_KEY=test_gsk_docs_OaPz8L5KdmQXkzRz3y47BMw6`

**Interfaces:**
- Consumes: auth() 세션, Product
- Produces: `POST /api/orders {slug}` → `{orderId, amount, orderName, customerName}` (서버가 가격 결정). success 페이지는 서버 컴포넌트에서 confirm 실행 후 결과 표시.
- confirm 핵심:
```ts
// lib/toss.ts
export async function confirmPayment(paymentKey: string, orderId: string, amount: number) {
  const res = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(process.env.TOSS_SECRET_KEY + ":").toString("base64")}`,
               "Content-Type": "application/json" },
    body: JSON.stringify({ paymentKey, orderId, amount }) })
  if (!res.ok) throw new Error((await res.json()).message)
  return res.json()
}
```
- success 서버 로직: orderId로 Order 조회 → `order.amount === Number(amount)` 검증 → confirm → PAID 업데이트. 이미 PAID면 멱등 처리.

**Steps:**
- [ ] SDK 설치, 주문 생성 API (재구매 방지: 동일 상품 PAID 존재 시 409)
- [ ] 결제 페이지: 위젯 렌더(결제수단+약관), 결제 요청 successUrl/failUrl 지정
- [ ] success: 금액 검증 → confirm → PAID, 실패 시 FAILED + 에러 표시. fail: FAILED 처리
- [ ] 테스트 키로 결제위젯 렌더 확인, 커밋

### Task 6: 마이페이지 + 다운로드

**Files:**
- Create: `app/mypage/page.tsx`, `app/api/download/[productId]/route.ts`, `public/downloads/goodauto-pro-setup.zip`(더미 zip)

**Interfaces:**
- Consumes: auth(), Order(PAID)
- Produces: 다운로드 API — 세션 확인 → 해당 상품 PAID 주문 확인 → zip 스트림 응답(Content-Disposition). 미구매 403.

**Steps:**
- [ ] 마이페이지: 내 정보, 주문 내역 테이블(상태 뱃지), PROGRAM 카테고리 PAID 주문에 다운로드 버튼
- [ ] 더미 zip 생성, 다운로드 API 구현
- [ ] 검증: 구매자만 다운로드 가능, 커밋

### Task 7: 프로그램 인증 API (JWT)

**Files:**
- Create: `lib/program-jwt.ts`, `app/api/program/login/route.ts`, `app/api/program/me/route.ts`, `app/api/program/license/route.ts`

**Interfaces:**
- Produces:
  - `POST /api/program/login {email,password}` → `{accessToken, expiresIn, user:{id,email,name}}` (JWT HS256, 7일, secret=`PROGRAM_JWT_SECRET` env)
  - `GET /api/program/me` (Bearer) → `{id,email,name}`
  - `GET /api/program/license?product=<slug>` (Bearer) → `{licensed: boolean, product, expiresAt: null}`
  - 401: 토큰 없음/무효, 403: SUSPENDED 계정

**Steps:**
- [ ] jose로 sign/verify 헬퍼, 세 엔드포인트 구현
- [ ] PowerShell/curl 스모크 테스트: 로그인 → me → license(미구매 false / 구매 true)
- [ ] 커밋

### Task 8: 어드민

**Files:**
- Create: `app/admin/layout.tsx`(role 검사 + 사이드바), `app/admin/page.tsx`(대시보드), `app/admin/users/page.tsx`, `app/admin/products/page.tsx`, `app/admin/orders/page.tsx`
- Create: `app/admin/actions.ts`(서버 액션: 회원 상태 토글, 상품 생성/수정/활성 토글)

**Interfaces:**
- Consumes: auth() role=ADMIN (layout + 서버 액션 양쪽에서 검사)
- Produces: 대시보드(회원 수, 주문 수, 총 매출), 회원 목록(정지/해제 버튼), 상품 CRUD 폼, 주문 목록(회원/상품/금액/상태/일시)

**Steps:**
- [ ] layout에서 비ADMIN 리다이렉트, 사이드바 네비
- [ ] 각 페이지 + 서버 액션 (액션 내부에서도 role 재검증)
- [ ] 검증: 일반 회원 접근 차단, 상태 토글 동작. 커밋

### Task 9: 통합 검증 + 마무리

**Steps:**
- [ ] `npm run build` 최종 통과
- [ ] 스모크 시나리오 전체 실행: 가입→로그인→상품→결제(위젯 렌더/confirm)→마이페이지→다운로드→프로그램 API→어드민
- [ ] 브라우저 육안 확인 (전 페이지, 반응형)
- [ ] README.md 작성 (실행법, .env 설정, 토스 실키 교체 방법, 프로그램 API 명세)
- [ ] 최종 커밋
