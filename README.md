# Optix 웹사이트

업무 자동화 프로그램·AI 자동화 솔루션 판매 사이트.
회원가입(휴대폰 문자 인증)/로그인, 상품 판매, 포트원(PortOne) V2 결제, 데스크톱 프로그램 인증 API, 어드민을 포함합니다.

## 기술 스택

- Next.js 16 (App Router, TypeScript, Turbopack)
- Tailwind CSS v4 — 다크 네이비 테마
- Prisma 6 + PostgreSQL 16 (Docker)
- Auth.js(next-auth v5) Credentials — 웹 세션 (서버 세션 테이블로 폐기·만료 관리)
- jose(JWT) — 데스크톱 프로그램 인증 API
- 포트원(PortOne) V2 브라우저 SDK — 단건 결제 (결제 단건 조회 + 웹훅으로 서버 검증)
- SOLAPI — 회원가입 인증·관리자 2단계 인증·청구서 안내 문자 발송

## 로컬 개발 실행

```bash
npm install
docker compose up -d db   # 개발용 PostgreSQL 기동 (호스트 127.0.0.1:12002)
npx prisma db push        # DB 스키마 생성
npx prisma db seed        # 시드 데이터 (계정/상품)
npm run dev               # http://localhost:12000
```

## 운영서버 Docker 배포

서버에 Docker + Docker Compose만 있으면 됩니다.

```bash
git clone <repo> && cd goodAutoSystems-Web
cp .env.production.example .env   # 값 채우기 (DB 비밀번호, 시크릿, 포트원 운영 키, 도메인)
docker compose up --build -d
```

- 구성: `db`(PostgreSQL 16, `pgdata` 볼륨 영속화) → `migrate`(스키마 반영+시드 후 종료) → `web`(Next.js standalone)
- 최초 기동 시 관리자 계정과 기본 상품이 자동 생성됩니다. 관리자 초기 비밀번호는 `SEED_ADMIN_PASSWORD`로 **반드시** 지정하세요(기본값 없음). 관리자 아이디는 운영자에게 별도로 공유합니다
- 관리자 로그인에는 문자 2단계 인증이 필요하므로 `SEED_ADMIN_PHONE`(관리자 휴대폰)과 `SOLAPI_*`를 함께 설정하세요
- 관리자 화면 경로는 운영자에게 별도로 공유합니다 (robots.txt 등 공개 파일에 적지 않음)
- `private-files/`는 호스트 바인드 마운트라 설치 파일을 서버에서 교체하면 재빌드 없이 반영됩니다
- 재배포: `git pull && docker compose up --build -d`
- `NEXT_PUBLIC_PORTONE_*` 값은 빌드 시 클라이언트 번들에 포함됩니다. `.env`에서 이 값을 바꾸면 `docker compose up --build -d`로 반드시 재빌드하세요 (`restart`만으로는 반영되지 않음). 이 두 값은 공개되어도 되는 식별자이며, 시크릿은 절대 `NEXT_PUBLIC_`으로 시작하는 이름에 넣지 마세요
- 포트: 웹 `WEB_PORT`(기본 12000), DB `DB_PORT`(기본 12002, 127.0.0.1에만 바인드). 컨테이너 내부는 3000/5432 그대로입니다.
- HTTPS는 서버의 nginx에서 `WEB_PORT`(기본 12000)로 프록시하세요. nginx 설정: `deploy/nginx/optix.goodautosys.kr.conf`
- `AUTH_URL`은 필수이며 실제 서비스 도메인(`https://optix.goodautosys.kr`)으로 설정해야 합니다. 비어 있거나 localhost면 로그아웃·결제 리다이렉트가 localhost로 이동합니다.

### 로컬 시드 계정

로컬 개발용 시드(`npx prisma db seed`)는 일반회원 테스트 계정(`user`)을 만듭니다. 관리자 계정 정보는 README에 적지 않습니다.
운영 컨테이너 시드(`prisma/seed.js`)는 테스트 회원을 만들지 않습니다.

## 환경 변수 (.env)

| 변수 | 설명 |
|------|------|
| `DATABASE_URL` | PostgreSQL 접속 문자열 (로컬: `postgresql://goodauto:<비밀번호>@localhost:12002/goodauto`) |
| `WEB_PORT` / `DB_PORT` | docker compose 호스트 포트 (기본 12000 / 12002) |
| `AUTH_SECRET` | Auth.js 세션 서명 키 + 관리자 인증번호 해시 키 (운영 전 교체, `openssl rand -base64 32`) |
| `PROGRAM_JWT_SECRET` | 프로그램 API JWT 서명 키 (운영 전 교체) |
| `NEXT_PUBLIC_PORTONE_STORE_ID` | 포트원 상점 아이디 (관리자 콘솔 > 연동 정보) |
| `NEXT_PUBLIC_PORTONE_CHANNEL_KEY` | 포트원 채널 키 (테스트/운영 채널별 발급) |
| `PORTONE_API_SECRET` | 포트원 V2 API Secret (서버 전용 — 결제 검증·취소) |
| `SOLAPI_API_KEY` / `SOLAPI_API_SECRET` | 솔라피 API 키 (인증 문자). 미설정 시 서버 콘솔에 인증번호 출력 — 운영에서는 필수 |
| `SOLAPI_SENDER` | 솔라피 콘솔에 등록된 발신번호 |
| `SEED_ADMIN_PASSWORD` | 시드 관리자 초기 비밀번호 (필수, 비밀번호 정책 충족) |

보안 관련 변수는 아래 [보안 운영](#보안-운영)을 참고하세요.

## 회원가입 휴대폰 인증

- 아이디(영문 소문자 시작, 소문자·숫자·밑줄 4~20자) 중복확인 → 휴대폰 번호로 6자리 인증번호 문자 발송 → 코드 검증 후 가입
- 인증번호 10분 유효, 재발송 60초 간격, 입력 5회 제한, IP당 1시간 10건 발송 제한
- 가입 시 이용약관·개인정보 수집·이용 동의(필수)를 받고 동의 일시를 저장합니다
- `SOLAPI_*`가 비어 있으면 문자 대신 서버 콘솔에 인증번호가 출력됩니다(로컬 개발용). 발송 점검: `npm run sms:test -- 01012345678`

**운영 전환:** 포트원 관리자 콘솔에서 운영 채널을 연동하고 채널 키·API Secret·웹훅 시크릿을 교체하면 됩니다.
결제 검증은 서버(`lib/portone.ts`)에서 결제 단건 조회(`GET /payments/{paymentId}`)로 처리하며,
결제 상태·금액은 항상 서버 DB의 주문 금액과 대조해 검증합니다. 웹훅도 서명 검증 후 같은 방식으로 재조회해 반영합니다.

## 보안 운영

### 보안 관련 환경 변수

| 변수 | 설명 |
|------|------|
| `PORTONE_WEBHOOK_SECRET` | 포트원 웹훅 서명 검증 시크릿. 포트원 콘솔 > 결제 연동 > 웹훅 설정에서 URL `https://optix.goodautosys.kr/api/webhooks/portone`, 버전 `2024-04-25`로 등록 후 발급된 시크릿(`whsec_...`) |
| `SEED_ADMIN_PHONE` | 시드 관리자 휴대폰 번호 — 관리자 2단계 인증 문자 수신 (숫자만, 예 `01012345678`) |
| `SECURITY_ALERT_PHONE` | 보안 알림 문자 수신 번호 (관리자 로그인, 관리자 계정 잠금, 결제 금액 불일치 등). 비우면 사이트 대표번호 |
| `DB_BIND` | PostgreSQL 호스트 바인드 주소 (기본 `127.0.0.1` — 외부 노출 금지) |
| `WEB_BIND` | 웹 포트 바인드 주소 (기본 `0.0.0.0`). 호스트 nginx면 `127.0.0.1` 권장, 컨테이너 nginx면 방화벽으로 12000 포트 외부 접근 차단 |
| `BACKUP_PASSPHRASE` | DB 백업 암호화 문구 (백업 스크립트 실행 환경에만 설정, 서버 밖에도 안전하게 보관) |

### 인증·세션

- **관리자 2단계 인증:** 관리자 계정은 아이디·비밀번호 확인 후 등록된 휴대폰으로 받은 6자리 인증번호(5분 유효, 5회 입력 제한)를 입력해야 로그인됩니다. SOLAPI 설정이 필수입니다
- **로그인 잠금:** 아이디당 연속 5회 실패 시 15분 잠금, IP당 10분 30회 시도 제한. 없는 아이디와 틀린 비밀번호는 같은 메시지·같은 처리 시간으로 응답합니다
- **비밀번호:** bcrypt(cost 12) 저장, 영문 대·소문자·숫자·특수문자 중 2종류 조합 10자 이상 또는 3종류 조합 8자 이상
- **세션:** 회원 3일 / 관리자 8시간 절대 만료. 로그아웃·비밀번호 변경·계정 정지·권한 변경 시 서버에서 즉시 폐기됩니다
- **접속기록:** 로그인 성공·실패, 관리자의 개인정보 열람·변경, 결제 검증 이벤트를 관리자 > 접속기록에서 확인할 수 있으며 2년 보관 후 자동 파기됩니다. 월 1회 이상 비정상 접근 여부를 점검하세요

### 결제

- 주문 금액은 서버의 상품·청구서 금액으로 확정하고, 결제 완료 후 포트원 조회 결과와 대조합니다
- 포트원 웹훅(`/api/webhooks/portone`)은 서명·타임스탬프를 검증한 뒤 결제를 재조회해 반영합니다
- 결제창을 열고 60분 안에 결제하지 않은 결제 대기 주문은 자동 만료(`EXPIRED`) 처리됩니다

### DB 백업·복구

`deploy/backup/` 스크립트는 운영 서버 호스트에서 실행합니다. 백업 파일은 AES-256으로 암호화되고 기본 14일 보관됩니다.

```bash
chmod +x deploy/backup/*.sh

# 수동 백업
BACKUP_PASSPHRASE='...' ./deploy/backup/pg-backup.sh

# 복구 테스트 (임시 DB에 복원해 회원·주문·청구서 건수 확인 후 삭제, 운영 DB는 건드리지 않음)
BACKUP_PASSPHRASE='...' ./deploy/backup/pg-restore.sh /var/backups/goodauto/goodauto-YYYYMMDD-HHMMSS.dump.enc

# 실제 복구 (운영 DB 덮어쓰기 — web 중지 후 복원)
BACKUP_PASSPHRASE='...' ./deploy/backup/pg-restore.sh <백업파일> --target goodauto --yes-i-understand
```

crontab 예시 (`crontab -e`, 암호 문구는 권한 600 파일에서 읽기):

```cron
# 매일 03:30 백업
30 3 * * * cd /srv/goodAutoSystems-Web && BACKUP_PASSPHRASE="$(cat /root/.goodauto-backup-pass)" ./deploy/backup/pg-backup.sh >> /var/log/goodauto-backup.log 2>&1
# 매월 1일 04:30 최신 백업으로 복구 테스트
30 4 1 * * cd /srv/goodAutoSystems-Web && BACKUP_PASSPHRASE="$(cat /root/.goodauto-backup-pass)" ./deploy/backup/pg-restore.sh "$(ls -1t /var/backups/goodauto/goodauto-*.dump.enc | head -1)" >> /var/log/goodauto-restore-test.log 2>&1
```

서버 장애에 대비해 `BACKUP_OFFSITE_CMD`(예: `rclone copy "$1" remote:goodauto-backup/`)로 외부 저장소에도 복사하세요.

### 로그 모니터링

```bash
# 보안 알림(관리자 로그인·계정 잠금·결제 금액 불일치·웹훅 서명 실패)과 감사 로그 실시간 확인
docker compose logs -f web | grep -E "\[security-alert\]|\[audit\]"
```

`SOLAPI_*`와 `SECURITY_ALERT_PHONE`이 설정되어 있으면 주요 보안 알림은 문자로도 발송됩니다(같은 종류 10분에 1건).

### 패치 정책

- 월 1회 `npm audit --omit=dev`로 운영 의존성 취약점을 확인하고, Next.js는 같은 메이저 내 최신 패치로 올립니다
- `node:22-slim`, `postgres:16-alpine` 이미지는 `docker compose build --pull`로 최신 패치를 반영합니다
- nginx는 보안 권고를 월 1회 확인해 업데이트합니다 (`deploy/nginx/optix.goodautosys.kr.conf` 상단 참고)
- 운영 컨테이너는 `NODE_ENV=production`으로 실행되어 오류 화면에 스택트레이스·경로가 노출되지 않습니다 (오류 코드만 표시)

## 주요 구조

```
app/
  page.tsx                  랜딩 (더미 영상 히어로 — public/videos/intro-placeholder.mp4 교체)
  products/                 상품 목록/상세
  services/, about/         서비스·회사소개
  contact/                  도입 문의
  privacy/, terms/          개인정보처리방침·이용약관
  (auth)/login, register    로그인(관리자 문자 2단계 인증)/회원가입
  mypage/                   내 정보·주문내역·프로그램 다운로드
  checkout/[slug]           포트원 결제창 호출
  checkout/success, fail    결제 승인/실패 처리
  optix-dev/                관리자 (대시보드·문의·회원·상품·주문·월결제·접속 통계·접속기록)
  api/
    auth/check-username     아이디 중복확인
    auth/send-verification  휴대폰 인증번호 문자 발송 (SOLAPI, IP당 1시간 10건)
    auth/register           회원가입 (인증번호 검증)
    orders                  PENDING 주문 생성 (서버 금액 확정)
    webhooks/portone        포트원 결제 웹훅 (서명 검증)
    download/[productId]    구매자 전용 설치파일 다운로드
    program/*               데스크톱 프로그램 인증 API
components/                 UI 컴포넌트
lib/                        prisma, portone, sms(SOLAPI), audit(접속기록), retention(보유기간 파기), rate-limit, validators …
prisma/                     스키마·시드
deploy/                     nginx 설정, DB 백업·복구 스크립트
private-files/              프로그램 설치 파일 (직접 URL 접근 불가)
```

## 데스크톱 프로그램 인증 API

프로그램은 웹사이트 계정(아이디/비밀번호)으로 로그인합니다.

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/program/login` | `{username, password}` → `{accessToken(7일), expiresIn, user{id, username, name}}` |
| GET | `/api/program/me` | `Authorization: Bearer <token>` → `{id, username, name}` |
| GET | `/api/program/license?product=<slug>` | 구매 여부 `{licensed, product, expiresAt}` |

- 401: 인증 실패/토큰 무효 · 403: 정지된 계정 · 429: 로그인 시도 초과
- 비밀번호 변경·계정 정지·탈퇴 시 기존 토큰은 무효화됩니다
- 프로그램 시작 시 `license` API로 사용권을 확인하세요. (단건 구매 = 영구 사용권, `expiresAt: null`)
- **2026-09 변경:** 로그인 요청 본문이 `{email, password}`에서 `{username, password}`로 바뀌었습니다. 프로그램 로그인 화면은 이메일 대신 아이디를 받아야 합니다.

## 교체가 필요한 더미 리소스

- `public/videos/intro-placeholder.mp4` — 실제 회사/제품 소개 영상으로 교체
- `private-files/goodauto-pro-setup.zip` — 실제 프로그램 설치 파일로 교체
- `.env`의 포트원 테스트 채널 키 → 운영 채널 키 (`NEXT_PUBLIC_PORTONE_*`는 재빌드 필요)
