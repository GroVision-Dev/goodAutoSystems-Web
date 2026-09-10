# Optix 웹사이트

업무 자동화 프로그램·AI 자동화 솔루션 판매 사이트.
회원가입(휴대폰 문자 인증)/로그인, 상품 판매, 토스페이먼츠 결제, 데스크톱 프로그램 인증 API, 어드민을 포함합니다.

## 기술 스택

- Next.js 16 (App Router, TypeScript, Turbopack)
- Tailwind CSS v4 — 다크 네이비 테마
- Prisma 6 + PostgreSQL 16 (Docker)
- Auth.js(next-auth v5) Credentials — 웹 세션
- jose(JWT) — 데스크톱 프로그램 인증 API
- 토스페이먼츠 결제위젯 v2 — 단건 결제
- SOLAPI — 회원가입 휴대폰 인증 문자 발송

## 로컬 개발 실행

```bash
npm install
docker compose up -d db   # 개발용 PostgreSQL 기동 (호스트 12002 포트)
npx prisma db push        # DB 스키마 생성
npx prisma db seed        # 시드 데이터 (계정/상품)
npm run dev               # http://localhost:12000
```

## 운영서버 Docker 배포

서버에 Docker + Docker Compose만 있으면 됩니다.

```bash
git clone <repo> && cd goodAutoSystems-Web
cp .env.production.example .env   # 값 채우기 (DB 비밀번호, 시크릿, 토스 실키, 도메인)
docker compose up --build -d
```

- 구성: `db`(PostgreSQL 16, `pgdata` 볼륨 영속화) → `migrate`(스키마 반영+시드 후 종료) → `web`(Next.js standalone)
- 최초 기동 시 관리자 계정(아이디 `admin`, 비밀번호는 `SEED_ADMIN_PASSWORD`)과 기본 상품이 자동 생성됩니다
- `private-files/`는 호스트 바인드 마운트라 설치 파일을 서버에서 교체하면 재빌드 없이 반영됩니다
- 재배포: `git pull && docker compose up --build -d`
- `NEXT_PUBLIC_PORTONE_*` 값은 빌드 시 클라이언트 번들에 포함됩니다. `.env`에서 이 값을 바꾸면 `docker compose up --build -d`로 반드시 재빌드하세요 (`restart`만으로는 반영되지 않음)
- 포트: 웹 `WEB_PORT`(기본 12000), DB `DB_PORT`(기본 12002). 컨테이너 내부는 3000/5432 그대로입니다.
- HTTPS는 서버의 nginx/Caddy 등 리버스 프록시에서 `WEB_PORT`(기본 12000)로 프록시하세요. nginx 예시: `deploy/nginx/optix.goodautosys.kr.conf`
- `AUTH_URL`은 필수이며 실제 서비스 도메인(`https://optix.goodautosys.kr`)으로 설정해야 합니다. 비어 있거나 localhost면 로그아웃·결제 리다이렉트가 localhost로 이동합니다.

### 시드 계정

| 구분 | 아이디 | 비밀번호 | 휴대폰 |
|------|--------|----------|--------|
| 관리자 | admin | admin1234! | 010-0000-0001 |
| 일반회원 | user | test1234! | 010-0000-0002 |

## 환경 변수 (.env)

| 변수 | 설명 |
|------|------|
| `DATABASE_URL` | PostgreSQL 접속 문자열 (로컬: `postgresql://goodauto:<비밀번호>@localhost:12002/goodauto`) |
| `WEB_PORT` / `DB_PORT` | docker compose 호스트 포트 (기본 12000 / 12002) |
| `AUTH_SECRET` | Auth.js 세션 서명 키 (운영 전 교체) |
| `PROGRAM_JWT_SECRET` | 프로그램 API JWT 서명 키 (운영 전 교체) |
| `NEXT_PUBLIC_PORTONE_STORE_ID` | 포트원 상점 아이디 (관리자 콘솔 > 연동 정보) |
| `NEXT_PUBLIC_PORTONE_CHANNEL_KEY` | 포트원 채널 키 (테스트/운영 채널별 발급) |
| `PORTONE_API_SECRET` | 포트원 V2 API Secret (서버 전용 — 결제 검증·취소) |
| `SOLAPI_API_KEY` / `SOLAPI_API_SECRET` | 솔라피 API 키 (회원가입 인증 문자). 미설정 시 서버 콘솔에 인증번호 출력 |
| `SOLAPI_SENDER` | 솔라피 콘솔에 등록된 발신번호 |

## 회원가입 휴대폰 인증

- 아이디(영문 소문자 시작, 소문자·숫자·밑줄 4~20자) 중복확인 → 휴대폰 번호로 6자리 인증번호 문자 발송 → 코드 검증 후 가입
- 인증번호 10분 유효, 재발송 60초 간격, 입력 5회 제한, IP당 1시간 10건 발송 제한
- `SOLAPI_*`가 비어 있으면 문자 대신 서버 콘솔에 인증번호가 출력됩니다(로컬 개발용). 발송 점검: `npm run sms:test -- 01012345678`

**운영 전환:** 포트원 관리자 콘솔에서 운영 채널을 연동하고 채널 키·API Secret만 교체하면 됩니다.
결제 검증은 서버(`lib/portone.ts`)에서 결제 단건 조회(`GET /payments/{paymentId}`)로 처리하며,
결제 상태·금액은 항상 서버 DB의 주문 금액과 대조해 검증합니다.

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
    auth/check-username     아이디 중복확인
    auth/send-verification  휴대폰 인증번호 문자 발송 (SOLAPI, IP당 1시간 10건)
    auth/register           회원가입 (인증번호 검증)
    orders                  PENDING 주문 생성 (서버 금액 확정)
    download/[productId]    구매자 전용 설치파일 다운로드
    program/*               데스크톱 프로그램 인증 API
components/                 UI 컴포넌트
lib/                        prisma, portone, sms(SOLAPI), phone, rate-limit, program-jwt, validators
prisma/                     스키마·시드
private-files/              프로그램 설치 파일 (직접 URL 접근 불가)
```

## 데스크톱 프로그램 인증 API

프로그램은 웹사이트 계정(아이디/비밀번호)으로 로그인합니다.

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/program/login` | `{username, password}` → `{accessToken(7일), expiresIn, user{id, username, name}}` |
| GET | `/api/program/me` | `Authorization: Bearer <token>` → `{id, username, name}` |
| GET | `/api/program/license?product=<slug>` | 구매 여부 `{licensed, product, expiresAt}` |

- 401: 인증 실패/토큰 무효 · 403: 정지된 계정
- 프로그램 시작 시 `license` API로 사용권을 확인하세요. (단건 구매 = 영구 사용권, `expiresAt: null`)
- **2026-09 변경:** 로그인 요청 본문이 `{email, password}`에서 `{username, password}`로 바뀌었습니다. 프로그램 로그인 화면은 이메일 대신 아이디를 받아야 합니다.

## 교체가 필요한 더미 리소스

- `public/videos/intro-placeholder.mp4` — 실제 회사/제품 소개 영상으로 교체
- `private-files/goodauto-pro-setup.zip` — 실제 프로그램 설치 파일로 교체
- `.env`의 토스 테스트 키 → 상점 실키
