# 회원가입 휴대폰 인증 전환 + 아이디 기반 계정 설계

작성일: 2026-09-07

## 목표

1. 회원가입 본인확인을 이메일 인증에서 **휴대폰 문자(SMS) 인증**으로 전환한다. 발송은 솔라피(SOLAPI) REST API를 사용한다.
2. 로그인 ID를 이메일에서 **사용자가 직접 입력하는 아이디(username)** 로 바꾸고, 가입 폼에 **아이디 중복확인** 기능을 둔다.
3. 이메일은 가입 시 입력받지 않는다.

수정 범위는 이 저장소(goodAutoSystems-Web)로 한정한다. 데스크톱 프로그램 등 이 API를 호출하는 외부 클라이언트는 손대지 않고, README에 변경 사항만 기록한다.

## 전제

- 운영 DB에는 시드 데이터만 있다. 마이그레이션 대신 DB 초기화 후 `prisma db push` + 재시드로 반영한다.
- 발신번호는 솔라피 콘솔에 사전 등록되어 있어야 한다(ito_lineage_macro_web과 동일 계정 사용).
- 기존 인증 정책(`lib/verification.ts`)은 그대로 쓴다: 코드 유효 10분, 재발송 간격 60초, 코드 입력 최대 5회.

## 아이디 규칙

- 영문 소문자로 시작, 영문 소문자·숫자·밑줄(`_`) 4~20자. 정규식 `^[a-z][a-z0-9_]{3,19}$`
- 입력값은 서버·클라이언트 모두 `trim().toLowerCase()` 후 검사·저장한다.
- 예약어(`admin`, `root`, `system`, `withdrawn`)는 시드 관리자 외 신규 가입에서 거부한다.

## 휴대폰 번호 규칙

- 하이픈·공백을 제거한 숫자만 저장한다. `010`으로 시작하는 11자리만 허용. 정규식 `^010\d{8}$`
- 정규화 함수 `normalizePhone(input): string | null` 을 `lib/sms.ts`에 둔다.

## 데이터 모델 (prisma/schema.prisma)

```prisma
model PhoneVerification {
  id        String   @id @default(cuid())
  phone     String   @unique
  code      String
  attempts  Int      @default(0)
  expiresAt DateTime
  createdAt DateTime @default(now())
}

model User {
  id           String     @id @default(cuid())
  username     String     @unique
  phone        String     @unique
  email        String?    @unique
  passwordHash String
  name         String
  ...기존 필드 유지
}
```

- `EmailVerification` 모델은 삭제한다.
- 탈퇴 익명화(`app/mypage/actions.ts`): `username = "withdrawn-<id>"`, `phone = "withdrawn-<id>"`, `email = null`, `name = "탈퇴회원"`, `passwordHash = ""`. 로그인·중복확인 정규식이 `withdrawn-` 접두어를 통과시키지 않으므로 충돌하지 않는다.
- 시드(`prisma/seed.ts`): 관리자 `admin` / `admin1234!` / phone `01000000001`, 테스트 회원 `user` / `test1234!` / phone `01000000002`. upsert 키는 `username`.

## SMS 발송 모듈 (`lib/sms.ts`, `lib/mailer.ts` 삭제)

ito_lineage_macro_web의 `api/app/services/sms_sender.py`를 TypeScript로 포팅한다. 외부 패키지를 추가하지 않는다.

- `normalizePhone(input)`: 위 규칙. 실패 시 `null`.
- `buildSolapiAuthHeader(apiKey, apiSecret, now = new Date(), salt = randomHex(16))`: `HMAC-SHA256 apiKey=..., date=<ISO8601>, salt=..., signature=<hmac_sha256(secret, date + salt) hex>`. 테스트를 위해 date/salt 주입 가능.
- `getSmsConfig()`: `SOLAPI_API_KEY`, `SOLAPI_API_SECRET`, `SOLAPI_SENDER` 셋이 모두 있으면 설정 객체, 아니면 `null`.
- `sendSms(to, text)`: `POST https://api.solapi.com/messages/v4/send`, body `{ message: { to, from, text } }`, 5초 타임아웃(AbortController). 2xx가 아니면 `SmsSendError(status, body)`를 던진다.
- `sendVerificationSms(phone, code)`: 설정이 없으면 개발 모드로 콘솔에 `[sms] SOLAPI 미설정 — 개발 모드. <phone> 인증번호: <code> (10분 유효)` 출력 후 반환. 설정이 있으면 `[Optix] 회원가입 인증번호 <code> (10분 유효)` 를 발송한다. 본문은 단문(SMS) 범위(90바이트) 이내로 유지한다.
- `isSmsDevMode()`: `getSmsConfig() === null`. send-verification 응답의 `devMode`에 사용.

점검 스크립트: `scripts/send-test-mail.mjs` 삭제, `scripts/send-test-sms.mjs` 추가. `npm run sms:test -- 01012345678` 로 `.env`의 SOLAPI 값으로 문자 1건을 보낸다. package.json의 `mail:test`를 `sms:test`로 교체하고 `nodemailer`, `@types/nodemailer` 의존성을 제거한다.

## 발송 남용 방지 (`lib/rate-limit.ts`)

문자는 건당 과금이므로 IP 기준 제한을 추가한다.

- `checkRateLimit(key, limit, windowMs): { ok: boolean; retryAfterSeconds: number }` — in-memory Map. 단일 컨테이너 운영이라 충분하다. 만료 항목은 호출 시 정리한다.
- send-verification: 키 `sms:<ip>`, 1시간 10건. 초과 시 429 `"인증번호 발송 한도를 초과했습니다. 잠시 후 다시 시도해 주세요."`
- IP는 `x-forwarded-for` 첫 값 → `x-real-ip` → `"unknown"` 순으로 읽는다.

## API

### `POST /api/auth/check-username` (신규)

- 요청 `{ username }`. 정규화 후 규칙·예약어 검사. 형식 오류는 400 + 메시지.
- 응답 `{ available: boolean }`. `prisma.user.findUnique({ where: { username } })` 결과로 판단.
- 응답에 존재하는 회원 정보는 포함하지 않는다.

### `POST /api/auth/send-verification` (변경)

- 요청 `{ phone }`. `normalizePhone` 실패 시 400 `"올바른 휴대폰 번호가 아닙니다. (010으로 시작하는 11자리)"`.
- IP 제한 검사 → 초과 시 429.
- 가입된 번호(`user.phone`)면 409 `"이미 가입된 휴대폰 번호입니다."`.
- `PhoneVerification` 재발송 간격 검사 → 429 (기존 메시지 유지).
- 6자리 코드 생성·upsert 후 `sendVerificationSms`. 실패 시 502 `"인증번호 발송에 실패했습니다. 잠시 후 다시 시도해 주세요."`.
- 응답 `{ ok, ttlMinutes, resendSeconds, devMode }` (형식 유지).

### `POST /api/auth/register` (변경)

- 요청 `{ username, name, phone, password, code }`. `registerSchema`(lib/validators.ts)로 검증. username은 `transform`으로 소문자화, phone은 `normalizePhone`으로 정규화.
- 순서: 아이디 중복(409 `"이미 사용 중인 아이디입니다."`) → 휴대폰 중복(409) → `PhoneVerification` 검증(기존 로직 그대로, 키만 phone) → 트랜잭션으로 User 생성 + PhoneVerification 삭제.
- 유니크 제약 위반(P2002)이 경합으로 발생하면 409로 응답한다.

### `POST /api/program/login` (변경)

- 요청 `{ username, password }`. `loginSchema`는 `username`, `password`.
- JWT payload: `sub = user.id`, `username`. `lib/program-jwt.ts`의 `ProgramTokenPayload`도 `{ sub, username }`으로 바꾼다.
- 응답 `user: { id, username, name }`. 오류 메시지의 "이메일"을 "아이디"로.

### `GET /api/program/me` (변경)

응답 `{ id, username, name }`.

### `POST /api/orders` (변경)

응답의 `customerEmail`을 제거하고 `customerPhone`(세션 사용자 phone)을 넣는다. `components/portone-checkout.tsx`는 `customer: { fullName, phoneNumber }`로 전달한다. 세션에 phone을 넣지 않고, 주문 생성 시 `prisma.user.findUnique`로 읽는다.

## 인증 (`auth.ts`)

- Credentials provider: `credentials: { username: {}, password: {} }`, `loginSchema`로 파싱 후 `findUnique({ where: { username } })`.
- `Session.user` 타입: `{ id, username, name, role }`. `authorize` 반환값에 `username` 포함, `jwt`/`session` 콜백에서 `username`을 토큰에 실어 세션으로 넘긴다.
- `session.user.email`을 참조하던 곳(주문 API)은 모두 제거한다.

## 화면

### 회원가입 폼 (`components/auth-forms.tsx` `RegisterForm`)

입력 순서와 동작:

1. 아이디 + [중복확인] 버튼. 클릭 시 `/api/auth/check-username` 호출. 결과를 아이디 아래에 표시(`사용 가능한 아이디입니다.` / `이미 사용 중인 아이디입니다.` / 형식 오류 메시지). 아이디 입력값이 바뀌면 확인 상태를 초기화한다.
2. 이름
3. 휴대폰 번호(`inputMode="tel"`, placeholder `휴대폰 번호 (010-0000-0000)`) + [인증번호 발송] 버튼. 기존 이메일 발송 버튼과 같은 재발송 쿨다운·유효시간 표시.
4. 인증번호 6자리 (발송 후 표시)
5. 비밀번호(8자 이상), 비밀번호 확인

가입 버튼은 아이디 중복확인이 "사용 가능"이고 인증번호가 발송된 상태에서만 활성화한다. 안내 문구: 개발 모드 `개발 모드: SOLAPI가 설정되지 않아 문자 대신 서버 콘솔에 인증번호가 출력됩니다.`, 운영 `인증번호를 문자로 발송했습니다. N분 안에 입력해 주세요.` 가입 성공 후 `signIn("credentials", { username, password })`.

### 로그인 폼 (`LoginForm`)

이메일 입력을 아이디(`name="username"`, `type="text"`, `autoComplete="username"`)로. 오류 문구 `아이디 또는 비밀번호가 올바르지 않거나 정지된 계정입니다.`

### 마이페이지 (`app/mypage/page.tsx`)

내 정보에 아이디·휴대폰 표시, 이메일 행 삭제. 안내 문구 `프로그램 로그인 시 위 아이디와 비밀번호를 동일하게 사용합니다.` 휴대폰은 `010-1234-5678` 형식으로 표시하는 `formatPhone` 헬퍼를 `lib/sms.ts`에 둔다.

### 어드민

- `app/admin/users/page.tsx`: 이메일 컬럼을 아이디·휴대폰으로. 검색 조건 `username | name | phone contains`.
- `app/admin/orders/page.tsx`, `app/admin/billing/page.tsx`, `components/admin-billing-forms.tsx`, `app/admin/page.tsx`: `user.email` 표시·검색·링크를 `user.username`으로.

## 설정·문서

- `.env.example`, `.env.production.example`: SMTP 블록을 아래로 교체.
  ```
  # 회원가입 휴대폰 인증 문자 (SOLAPI). 미설정 시 문자 대신 서버 콘솔에 인증번호 출력
  # 발신번호(SOLAPI_SENDER)는 SOLAPI 콘솔에서 사전 등록 필요
  SOLAPI_API_KEY=
  SOLAPI_API_SECRET=
  SOLAPI_SENDER=
  ```
- `docker-compose.yml`: `SMTP_*` 환경변수를 `SOLAPI_API_KEY`, `SOLAPI_API_SECRET`, `SOLAPI_SENDER`로 교체.
- `README.md`: 회원가입 인증 설명, 환경변수 표, 데스크톱 프로그램 인증 API 표(`{username, password}`)를 갱신하고, "프로그램 로그인 요청 본문이 email → username으로 바뀌었다"는 변경 이력을 한 줄 남긴다.

## 테스트

`package.json`의 `test` 스크립트를 `tsx --test lib/*.test.ts`로 바꾼다.

- `lib/sms.test.ts`
  - `normalizePhone`: `010-1234-5678` → `01012345678`, 공백 포함, 10자리·`011` 시작·문자 포함은 `null`.
  - `buildSolapiAuthHeader`: 고정 date/salt로 서명이 `hmac_sha256(secret, date+salt)` hex와 일치, 헤더 형식 검증.
  - `sendVerificationSms`: 환경변수 미설정 시 fetch 호출 없이 반환. 설정 시 fetch URL·body(`to`/`from`/`text`)·Authorization 헤더 검증. 4xx/5xx 응답이면 `SmsSendError`.
  - `formatPhone`: `01012345678` → `010-1234-5678`.
- `lib/validators.test.ts`
  - `usernameSchema`: `abcd`·`user_01` 통과, `Abc1` → `abc1`로 변환, `1abc`·`abc`·21자·한글·예약어 거부.
  - `registerSchema`: phone 하이픈 입력이 정규화되어 통과.
- `lib/rate-limit.test.ts`: 한도 내 ok, 초과 시 `retryAfterSeconds > 0`, 윈도우 경과 후 초기화(시간 주입).

fetch mock 방식은 `lib/portone.test.ts`를 따른다.

## 구현 순서(요약)

1. 스키마·시드·validators·sms·rate-limit 모듈과 테스트
2. API 라우트(check-username, send-verification, register, program/login, program/me, orders)
3. auth.ts 세션 타입 변경과 이를 참조하는 컴포넌트
4. 화면(회원가입·로그인·마이페이지·어드민)
5. 설정·문서·의존성 정리, `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`
