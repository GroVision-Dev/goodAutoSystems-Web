# 굿오토시스템즈 웹사이트

업무 자동화 프로그램·AI 자동화 솔루션 판매 사이트.
회원가입/로그인, 상품 판매, 토스페이먼츠 결제, 데스크톱 프로그램 인증 API, 어드민을 포함합니다.

## 기술 스택

- Next.js 16 (App Router, TypeScript, Turbopack)
- Tailwind CSS v4 — 다크 네이비 테마
- Prisma 6 + SQLite (`prisma/dev.db`)
- Auth.js(next-auth v5) Credentials — 웹 세션
- jose(JWT) — 데스크톱 프로그램 인증 API
- 토스페이먼츠 결제위젯 v2 — 단건 결제

## 실행 방법

```bash
npm install
npx prisma db push      # DB 스키마 생성
npx prisma db seed      # 시드 데이터 (계정/상품)
npm run dev             # http://localhost:3000
```

### 시드 계정

| 구분 | 이메일 | 비밀번호 |
|------|--------|----------|
| 관리자 | admin@goodautosystems.com | admin1234! |
| 일반회원 | user@test.com | test1234! |

## 환경 변수 (.env)

| 변수 | 설명 |
|------|------|
| `DATABASE_URL` | SQLite 경로 (`file:./dev.db`) |
| `AUTH_SECRET` | Auth.js 세션 서명 키 (운영 전 교체) |
| `PROGRAM_JWT_SECRET` | 프로그램 API JWT 서명 키 (운영 전 교체) |
| `NEXT_PUBLIC_TOSS_CLIENT_KEY` | 토스 클라이언트 키 (현재 문서용 테스트 키) |
| `TOSS_SECRET_KEY` | 토스 시크릿 키 (현재 문서용 테스트 키) |

**운영 전환:** 토스페이먼츠 상점 관리자에서 발급받은 실키로 두 키만 교체하면 됩니다.
결제 승인은 서버(`lib/toss.ts`)에서 `/v1/payments/confirm` 호출로 처리하며,
금액은 항상 서버 DB의 주문 금액으로 검증합니다.

## 주요 구조

```
app/
  page.tsx                  랜딩 (더미 영상 히어로 — public/videos/intro-placeholder.mp4 교체)
  products/                 상품 목록/상세
  services/, about/         서비스·회사소개
  (auth)/login, register    로그인/회원가입
  mypage/                   내 정보·주문내역·프로그램 다운로드
  checkout/[slug]           토스 결제위젯
  checkout/success, fail    결제 승인/실패 처리
  admin/                    관리자 (대시보드·회원·상품·주문)
  api/
    auth/register           회원가입
    orders                  PENDING 주문 생성 (서버 금액 확정)
    download/[productId]    구매자 전용 설치파일 다운로드
    program/*               데스크톱 프로그램 인증 API
components/                 UI 컴포넌트
lib/                        prisma, toss, program-jwt, validators
prisma/                     스키마·시드
private-files/              프로그램 설치 파일 (직접 URL 접근 불가)
```

## 데스크톱 프로그램 인증 API

프로그램은 웹사이트 계정으로 로그인합니다.

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/program/login` | `{email, password}` → `{accessToken(7일), expiresIn, user}` |
| GET | `/api/program/me` | `Authorization: Bearer <token>` → 내 정보 |
| GET | `/api/program/license?product=<slug>` | 구매 여부 `{licensed, product, expiresAt}` |

- 401: 인증 실패/토큰 무효 · 403: 정지된 계정
- 프로그램 시작 시 `license` API로 사용권을 확인하세요. (단건 구매 = 영구 사용권, `expiresAt: null`)

## 교체가 필요한 더미 리소스

- `public/videos/intro-placeholder.mp4` — 실제 회사/제품 소개 영상으로 교체
- `private-files/goodauto-pro-setup.zip` — 실제 프로그램 설치 파일로 교체
- `.env`의 토스 테스트 키 → 상점 실키
