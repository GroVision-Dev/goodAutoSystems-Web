# 회원가입 휴대폰 인증 전환 + 아이디 기반 계정 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 회원가입 본인확인을 이메일에서 솔라피(SOLAPI) 문자 인증으로 바꾸고, 로그인 ID를 이메일에서 사용자가 입력하는 아이디(username, 중복확인 포함)로 전환한다.

**Architecture:** 인증 정책(`lib/verification.ts`)과 "코드 생성 → DB 저장 → 발송 → 검증" 흐름은 그대로 두고 발송 채널만 SMTP → SOLAPI REST(HMAC-SHA256, `fetch` + `node:crypto`)로 교체한다. `User`에 `username`·`phone`을 필수 유니크 컬럼으로 추가하고 `email`은 선택으로 내린 뒤, NextAuth Credentials·프로그램 JWT API·어드민 화면이 모두 `username`으로 계정을 식별하게 바꾼다.

**Tech Stack:** Next.js 16 App Router, Prisma 6 + PostgreSQL, Auth.js(next-auth v5) Credentials, zod 4, jose, `node:test` + tsx.

**Spec:** `docs/superpowers/specs/2026-09-07-phone-verification-username-design.md`

## Global Constraints

- 수정 범위는 이 저장소만. 외부(데스크톱 프로그램) 코드는 손대지 않는다.
- 새 npm 의존성을 추가하지 않는다. `nodemailer`, `@types/nodemailer`는 제거한다.
- 아이디 규칙: `^[a-z][a-z0-9_]{3,19}$`, 예약어 `admin`, `root`, `system`, `withdrawn` 거부, 저장 전 `trim().toLowerCase()`.
- 휴대폰 규칙: 숫자만 저장, `^010\d{8}$`.
- 인증 정책은 `lib/verification.ts` 값을 그대로 사용: TTL 10분, 재발송 60초, 시도 5회.
- SMS 발송 IP 제한: 1시간 10건.
- 문자 본문: `[Optix] 회원가입 인증번호 <code> (10분 유효)`.
- 환경변수: `SOLAPI_API_KEY`, `SOLAPI_API_SECRET`, `SOLAPI_SENDER`. 셋 중 하나라도 없으면 개발 모드(콘솔 출력).
- DB는 마이그레이션 없이 `npx prisma db push --force-reset` 후 `npx prisma db seed`로 재생성한다(운영 DB에 시드만 존재).
- 테스트는 `node:test` + `tsx --test`, fetch mock 방식은 `lib/portone.test.ts`를 따른다.
- 커밋 메시지는 한국어 `feat:`/`refactor:`/`docs:` 접두어, 아래 트레일러를 붙인다:
  ```
  Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01VzK4rtCrALfuaqMLjvzFPW
  ```
- 작업 트리에는 이 작업과 무관한 미커밋 변경(월결제 기능 등)이 많다. 커밋할 때는 `git add <파일>`로 이 플랜이 만진 파일만 올린다. `git add -A`/`git add .` 금지.
- 이 저장소의 Bash 툴은 가끔 멈춘다. 셸 명령은 PowerShell 툴로 실행한다. PowerShell 5.1이라 `&&` 대신 `;`를 쓴다.

---

## File Structure

| 파일 | 역할 | 작업 |
|---|---|---|
| `prisma/schema.prisma` | `PhoneVerification` 모델, `User.username/phone/email?` | Task 1 |
| `prisma/seed.ts`, `prisma/seed.js` | 시드 계정을 username/phone 기준으로 | Task 1 |
| `lib/phone.ts` (+test) | `normalizePhone`, `formatPhone` 순수 함수 | Task 2 |
| `lib/validators.ts` (+test) | `usernameSchema`, `phoneSchema`, `registerSchema`, `loginSchema` | Task 3 |
| `lib/sms.ts` (+test) | SOLAPI 발송, HMAC 헤더, 개발 모드 | Task 4 |
| `lib/rate-limit.ts` (+test) | in-memory IP 제한, `getClientIp` | Task 5 |
| `app/api/auth/check-username/route.ts` | 아이디 중복확인 API | Task 6 |
| `app/api/auth/send-verification/route.ts` | phone 기준 발송 API | Task 7 |
| `app/api/auth/register/route.ts` | username/phone/code 가입 API | Task 7 |
| `auth.ts` | Credentials username 로그인, 세션 타입 | Task 8 |
| `lib/program-jwt.ts`, `app/api/program/login/route.ts`, `app/api/program/me/route.ts` | 프로그램 API username 전환 | Task 8 |
| `app/api/orders/route.ts`, `components/portone-checkout.tsx` | 결제 고객정보 email → phone | Task 8 |
| `components/auth-forms.tsx` | 회원가입(아이디 중복확인·문자 인증)·로그인 폼 | Task 9 |
| `app/mypage/page.tsx`, `app/mypage/actions.ts` | 내 정보 표시, 탈퇴 익명화 | Task 10 |
| `app/admin/users/page.tsx`, `app/admin/orders/page.tsx`, `app/admin/billing/page.tsx`, `app/admin/page.tsx`, `components/admin-billing-forms.tsx` | 어드민 email → username/phone | Task 11 |
| `app/terms/page.tsx`, `app/privacy/page.tsx` | 약관·개인정보 문구 | Task 11 |
| `lib/mailer.ts`, `scripts/send-test-mail.mjs` → 삭제, `scripts/send-test-sms.mjs` 신규, `package.json` | 메일 잔재 제거, SMS 점검 스크립트 | Task 12 |
| `.env.example`, `.env.production.example`, `docker-compose.yml`, `README.md` | SOLAPI 환경변수·문서 | Task 12 |

---

### Task 1: Prisma 스키마·시드를 username/phone 기준으로 변경

**Files:**
- Modify: `prisma/schema.prisma:39-61`
- Modify: `prisma/seed.ts:6-29`
- Modify: `prisma/seed.js:8-23`

**Interfaces:**
- Produces: `prisma.phoneVerification` (필드 `phone`(unique), `code`, `attempts`, `expiresAt`, `createdAt`), `User.username: string`(unique), `User.phone: string`(unique), `User.email: string | null`(unique). 이후 모든 Task가 이 필드를 사용한다.

- [ ] **Step 1: 스키마 수정**

`prisma/schema.prisma`의 `model EmailVerification { ... }` 블록과 `model User`의 앞부분을 다음으로 바꾼다.

```prisma
/// 회원가입 휴대폰 문자 인증 — phone은 숫자만(01012345678)
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
  /// 로그인 아이디 — 영문 소문자 시작, 소문자·숫자·밑줄 4~20자
  username     String     @unique
  /// 휴대폰 번호 — 숫자만(01012345678), 문자 인증 완료된 번호
  phone        String     @unique
  /// 가입 시 수집하지 않음. 과거 데이터 호환용
  email        String?    @unique
  passwordHash String
  name         String
  role         Role       @default(USER)
  status       UserStatus @default(ACTIVE)
  createdAt    DateTime   @default(now())
  /// 회원별 월 결제 설정 (관리자 지정) — 일괄 청구서 생성 시 기본값
  monthlyAmount Int?
  monthlyTitle  String?
  orders       Order[]
  invoices     Invoice[]
}
```

- [ ] **Step 2: seed.ts 수정**

`prisma/seed.ts`의 두 `prisma.user.upsert` 호출을 다음으로 교체한다.

```ts
  const adminPassword = await bcrypt.hash(
    process.env.SEED_ADMIN_PASSWORD || "admin1234!",
    10
  );
  const userPassword = await bcrypt.hash("test1234!", 10);

  await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      phone: "01000000001",
      passwordHash: adminPassword,
      name: "관리자",
      role: "ADMIN",
    },
  });

  await prisma.user.upsert({
    where: { username: "user" },
    update: {},
    create: {
      username: "user",
      phone: "01000000002",
      passwordHash: userPassword,
      name: "테스트회원",
    },
  });
```

- [ ] **Step 3: seed.js 수정**

`prisma/seed.js`의 `prisma.user.upsert` 호출을 다음으로 교체한다.

```js
  await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      phone: "01000000001",
      passwordHash: adminPassword,
      name: "관리자",
      role: "ADMIN",
    },
  });
```

- [ ] **Step 4: DB 재생성 + 클라이언트 생성**

Run (PowerShell):
```powershell
npx prisma db push --force-reset --accept-data-loss; npx prisma db seed
```
Expected: `Your database is now in sync with your Prisma schema.` 와 `시드 데이터 생성 완료`. DB가 안 떠 있으면 먼저 `docker compose up -d db`.

- [ ] **Step 5: 타입체크로 깨진 참조 목록 확인 (실패 예상)**

Run: `npx tsc --noEmit`
Expected: `emailVerification`, `user.email`, `where: { email }` 관련 오류가 auth.ts, register/send-verification/program 라우트, 어드민 페이지 등에서 발생. 이 목록은 이후 Task에서 모두 고친다. 지금은 고치지 않는다.

- [ ] **Step 6: 커밋**

```powershell
git add prisma/schema.prisma prisma/seed.ts prisma/seed.js
git commit -m "feat: User에 username·phone 추가, EmailVerification → PhoneVerification"
```

---

### Task 2: `lib/phone.ts` — 휴대폰 번호 정규화·표시

**Files:**
- Create: `lib/phone.ts`
- Test: `lib/phone.test.ts`

**Interfaces:**
- Produces: `normalizePhone(input: string): string | null`, `formatPhone(phone: string): string`, `PHONE_PATTERN: RegExp`.

- [ ] **Step 1: 실패하는 테스트 작성**

`lib/phone.test.ts`:

```ts
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { normalizePhone, formatPhone } from "./phone";

describe("normalizePhone", () => {
  test("하이픈을 제거한다", () => {
    assert.equal(normalizePhone("010-1234-5678"), "01012345678");
  });

  test("공백·괄호를 제거한다", () => {
    assert.equal(normalizePhone(" 010 1234 5678 "), "01012345678");
  });

  test("이미 숫자만이면 그대로", () => {
    assert.equal(normalizePhone("01012345678"), "01012345678");
  });

  test("10자리는 거부", () => {
    assert.equal(normalizePhone("010-123-4567"), null);
  });

  test("011로 시작하면 거부", () => {
    assert.equal(normalizePhone("011-1234-5678"), null);
  });

  test("숫자 외 문자가 섞이면 거부", () => {
    assert.equal(normalizePhone("0101234567a"), null);
  });

  test("빈 문자열은 거부", () => {
    assert.equal(normalizePhone(""), null);
  });
});

describe("formatPhone", () => {
  test("11자리를 3-4-4로 나눈다", () => {
    assert.equal(formatPhone("01012345678"), "010-1234-5678");
  });

  test("형식이 다르면 입력 그대로", () => {
    assert.equal(formatPhone("withdrawn-abc"), "withdrawn-abc");
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx tsx --test lib/phone.test.ts`
Expected: FAIL — `Cannot find module './phone'`

- [ ] **Step 3: 구현**

`lib/phone.ts`:

```ts
/** 저장 형식: 숫자만, 010으로 시작하는 11자리 */
export const PHONE_PATTERN = /^010\d{8}$/;

/**
 * 입력값에서 숫자만 남기고 형식을 검사한다.
 * "010-1234-5678" → "01012345678", 형식이 맞지 않으면 null.
 */
export function normalizePhone(input: string): string | null {
  const digits = (input ?? "").replace(/\D/g, "");
  return PHONE_PATTERN.test(digits) ? digits : null;
}

/** "01012345678" → "010-1234-5678". 저장 형식이 아니면 입력 그대로 반환. */
export function formatPhone(phone: string): string {
  if (!PHONE_PATTERN.test(phone)) return phone;
  return `${phone.slice(0, 3)}-${phone.slice(3, 7)}-${phone.slice(7)}`;
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx tsx --test lib/phone.test.ts`
Expected: 9 tests pass.

- [ ] **Step 5: 커밋**

```powershell
git add lib/phone.ts lib/phone.test.ts
git commit -m "feat: 휴대폰 번호 정규화·표시 헬퍼(lib/phone)"
```

---

### Task 3: `lib/validators.ts` — 아이디·휴대폰 스키마

**Files:**
- Modify: `lib/validators.ts` (전체 교체)
- Test: `lib/validators.test.ts`

**Interfaces:**
- Consumes: `normalizePhone` (Task 2)
- Produces:
  - `USERNAME_PATTERN`, `RESERVED_USERNAMES`
  - `usernameSchema: ZodType<string>` — trim·소문자화·규칙·예약어 검사
  - `phoneSchema: ZodType<string>` — 정규화된 11자리 반환
  - `registerSchema` → `{ username, name, phone, password, code }`
  - `loginSchema` → `{ username, password }`
  - `USERNAME_RULE_MESSAGE`, `PHONE_RULE_MESSAGE` 상수(API·폼 공용 문구)

- [ ] **Step 1: 실패하는 테스트 작성**

`lib/validators.test.ts`:

```ts
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { usernameSchema, phoneSchema, registerSchema, loginSchema } from "./validators";

describe("usernameSchema", () => {
  test("소문자·숫자·밑줄 4~20자 통과", () => {
    assert.equal(usernameSchema.parse("abcd"), "abcd");
    assert.equal(usernameSchema.parse("user_01"), "user_01");
    assert.equal(usernameSchema.parse("a".repeat(20)), "a".repeat(20));
  });

  test("대문자·공백은 정규화된다", () => {
    assert.equal(usernameSchema.parse("  Abc1 "), "abc1");
  });

  test("숫자로 시작하면 거부", () => {
    assert.equal(usernameSchema.safeParse("1abc").success, false);
  });

  test("3자는 거부", () => {
    assert.equal(usernameSchema.safeParse("abc").success, false);
  });

  test("21자는 거부", () => {
    assert.equal(usernameSchema.safeParse("a".repeat(21)).success, false);
  });

  test("한글·특수문자 거부", () => {
    assert.equal(usernameSchema.safeParse("아이디123").success, false);
    assert.equal(usernameSchema.safeParse("abc-def").success, false);
  });

  test("예약어 거부", () => {
    for (const reserved of ["admin", "root", "system", "withdrawn"]) {
      assert.equal(usernameSchema.safeParse(reserved).success, false, reserved);
    }
  });
});

describe("phoneSchema", () => {
  test("하이픈 입력을 숫자로 정규화", () => {
    assert.equal(phoneSchema.parse("010-1234-5678"), "01012345678");
  });

  test("형식 오류는 메시지와 함께 거부", () => {
    const result = phoneSchema.safeParse("02-123-4567");
    assert.equal(result.success, false);
    if (!result.success) {
      assert.match(result.error.issues[0].message, /010으로 시작하는 11자리/);
    }
  });
});

describe("registerSchema", () => {
  test("정상 입력 파싱", () => {
    const parsed = registerSchema.parse({
      username: "Hong_gd",
      name: "홍길동",
      phone: "010-1234-5678",
      password: "password1",
      code: "123456",
    });
    assert.deepEqual(parsed, {
      username: "hong_gd",
      name: "홍길동",
      phone: "01012345678",
      password: "password1",
      code: "123456",
    });
  });

  test("코드가 6자리 숫자가 아니면 거부", () => {
    const result = registerSchema.safeParse({
      username: "hong",
      name: "홍길동",
      phone: "01012345678",
      password: "password1",
      code: "12ab",
    });
    assert.equal(result.success, false);
  });
});

describe("loginSchema", () => {
  test("아이디를 소문자로 정규화", () => {
    assert.deepEqual(loginSchema.parse({ username: " Admin ", password: "x" }), {
      username: "admin",
      password: "x",
    });
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx tsx --test lib/validators.test.ts`
Expected: FAIL — `usernameSchema`/`phoneSchema` export 없음.

- [ ] **Step 3: 구현**

`lib/validators.ts` 전체:

```ts
import { z } from "zod";
import { normalizePhone } from "@/lib/phone";

export const USERNAME_PATTERN = /^[a-z][a-z0-9_]{3,19}$/;
export const RESERVED_USERNAMES = ["admin", "root", "system", "withdrawn"];
export const USERNAME_RULE_MESSAGE =
  "아이디는 영문 소문자로 시작하는 영문 소문자·숫자·밑줄(_) 4~20자입니다.";
export const PHONE_RULE_MESSAGE =
  "올바른 휴대폰 번호가 아닙니다. (010으로 시작하는 11자리)";

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(USERNAME_PATTERN, USERNAME_RULE_MESSAGE)
  .refine((v) => !RESERVED_USERNAMES.includes(v), "사용할 수 없는 아이디입니다.");

/** 하이픈·공백 포함 입력을 받아 숫자 11자리로 정규화한다 */
export const phoneSchema = z.string().transform((value, ctx) => {
  const normalized = normalizePhone(value);
  if (!normalized) {
    ctx.addIssue({ code: "custom", message: PHONE_RULE_MESSAGE });
    return z.NEVER;
  }
  return normalized;
});

export const registerSchema = z.object({
  username: usernameSchema,
  name: z.string().trim().min(2, "이름은 2자 이상이어야 합니다."),
  phone: phoneSchema,
  password: z.string().min(8, "비밀번호는 8자 이상이어야 합니다."),
  code: z.string().regex(/^\d{6}$/, "인증코드 6자리를 입력해 주세요."),
});

export const loginSchema = z.object({
  username: z.string().trim().toLowerCase().min(1),
  password: z.string().min(1),
});
```

- [ ] **Step 4: 통과 확인**

Run: `npx tsx --test lib/validators.test.ts`
Expected: 모든 테스트 pass. (`z.NEVER`, `ctx.addIssue({ code: "custom" })`, `.toLowerCase()`는 zod 4에서 지원. 컴파일 오류가 나면 `node_modules/zod/README.md`에서 v4 transform 문법 확인.)

- [ ] **Step 5: 커밋**

```powershell
git add lib/validators.ts lib/validators.test.ts
git commit -m "feat: 아이디·휴대폰 zod 스키마 (username 규칙, phone 정규화)"
```

---

### Task 4: `lib/sms.ts` — SOLAPI 발송 모듈

**Files:**
- Create: `lib/sms.ts`
- Test: `lib/sms.test.ts`

**Interfaces:**
- Consumes: `VERIFICATION_TTL_MINUTES` (`lib/verification.ts`)
- Produces:
  - `getSmsConfig(): SmsConfig | null`, `isSmsDevMode(): boolean`
  - `buildSolapiAuthHeader(apiKey, apiSecret, date?, salt?): string`
  - `class SmsSendError extends Error { status: number; body: string }`
  - `sendSms(to: string, text: string, config?: SmsConfig | null): Promise<void>`
  - `verificationSmsText(code: string): string`
  - `sendVerificationSms(phone: string, code: string): Promise<void>`

- [ ] **Step 1: 실패하는 테스트 작성**

`lib/sms.test.ts`:

```ts
import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  buildSolapiAuthHeader,
  sendSms,
  sendVerificationSms,
  verificationSmsText,
  getSmsConfig,
  SmsSendError,
} from "./sms";

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };

function mockFetch(status: number, body: unknown = {}) {
  const calls: { url: string; init?: RequestInit }[] = [];
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify(body), { status });
  }) as typeof fetch;
  return calls;
}

function setSolapiEnv() {
  process.env.SOLAPI_API_KEY = "KEY123";
  process.env.SOLAPI_API_SECRET = "SECRET456";
  process.env.SOLAPI_SENDER = "010-9999-8888";
}

beforeEach(() => {
  delete process.env.SOLAPI_API_KEY;
  delete process.env.SOLAPI_API_SECRET;
  delete process.env.SOLAPI_SENDER;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  process.env = { ...originalEnv };
});

describe("buildSolapiAuthHeader", () => {
  test("HMAC-SHA256(secret, date + salt) hex 서명을 포함한다", () => {
    const date = "2026-09-07T00:00:00.000Z";
    const salt = "abcdef0123456789abcdef0123456789";
    const expected = createHmac("sha256", "SECRET456").update(date + salt).digest("hex");
    assert.equal(
      buildSolapiAuthHeader("KEY123", "SECRET456", date, salt),
      `HMAC-SHA256 apiKey=KEY123, date=${date}, salt=${salt}, signature=${expected}`
    );
  });

  test("date/salt 미지정 시 ISO 날짜와 32자 hex salt를 생성한다", () => {
    const header = buildSolapiAuthHeader("KEY123", "SECRET456");
    assert.match(header, /^HMAC-SHA256 apiKey=KEY123, date=\d{4}-\d{2}-\d{2}T[^,]+, salt=[0-9a-f]{32}, signature=[0-9a-f]{64}$/);
  });
});

describe("getSmsConfig", () => {
  test("환경변수가 하나라도 없으면 null", () => {
    process.env.SOLAPI_API_KEY = "k";
    process.env.SOLAPI_API_SECRET = "s";
    assert.equal(getSmsConfig(), null);
  });

  test("발신번호는 숫자만 남긴다", () => {
    setSolapiEnv();
    assert.deepEqual(getSmsConfig(), { apiKey: "KEY123", apiSecret: "SECRET456", sender: "01099998888" });
  });
});

describe("sendSms", () => {
  test("SOLAPI 단건 발송 API를 호출한다", async () => {
    setSolapiEnv();
    const calls = mockFetch(200, { groupId: "G1" });
    await sendSms("01012345678", "hello");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://api.solapi.com/messages/v4/send");
    assert.equal(calls[0].init?.method, "POST");
    const headers = calls[0].init?.headers as Record<string, string>;
    assert.match(headers.Authorization, /^HMAC-SHA256 apiKey=KEY123, /);
    assert.equal(headers["Content-Type"], "application/json");
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {
      message: { to: "01012345678", from: "01099998888", text: "hello" },
    });
  });

  test("2xx가 아니면 SmsSendError", async () => {
    setSolapiEnv();
    mockFetch(400, { errorCode: "ValidationError", errorMessage: "bad" });
    await assert.rejects(sendSms("01012345678", "hello"), (e: unknown) => {
      assert.ok(e instanceof SmsSendError);
      assert.equal(e.status, 400);
      assert.match(e.body, /ValidationError/);
      return true;
    });
  });

  test("설정이 없으면 호출 전에 에러", async () => {
    const calls = mockFetch(200);
    await assert.rejects(sendSms("01012345678", "hello"), /SOLAPI 설정/);
    assert.equal(calls.length, 0);
  });
});

describe("sendVerificationSms", () => {
  test("본문에 코드와 유효시간이 들어간다", () => {
    assert.equal(verificationSmsText("123456"), "[Optix] 회원가입 인증번호 123456 (10분 유효)");
  });

  test("개발 모드(설정 없음)에서는 fetch를 호출하지 않는다", async () => {
    const calls = mockFetch(200);
    await sendVerificationSms("01012345678", "123456");
    assert.equal(calls.length, 0);
  });

  test("설정이 있으면 인증번호 문자를 보낸다", async () => {
    setSolapiEnv();
    const calls = mockFetch(200);
    await sendVerificationSms("01012345678", "123456");
    const body = JSON.parse(String(calls[0].init?.body));
    assert.equal(body.message.to, "01012345678");
    assert.equal(body.message.text, "[Optix] 회원가입 인증번호 123456 (10분 유효)");
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx tsx --test lib/sms.test.ts`
Expected: FAIL — `Cannot find module './sms'`

- [ ] **Step 3: 구현**

`lib/sms.ts`:

```ts
import { createHmac, randomBytes } from "node:crypto";
import { VERIFICATION_TTL_MINUTES } from "@/lib/verification";

/**
 * SOLAPI(쿨SMS) 단건 문자 발송.
 * ito_lineage_macro_web의 api/app/services/sms_sender.py를 포팅했다.
 * SDK 없이 REST API + HMAC-SHA256 인증 헤더를 직접 만든다.
 * SOLAPI_* 환경변수가 없으면(로컬 개발) 발송 대신 서버 콘솔에 코드를 출력한다.
 */

const SOLAPI_SEND_URL = "https://api.solapi.com/messages/v4/send";
const REQUEST_TIMEOUT_MS = 5000;

export interface SmsConfig {
  apiKey: string;
  apiSecret: string;
  /** 발신번호 — 숫자만. SOLAPI 콘솔에 사전 등록된 번호여야 한다 */
  sender: string;
}

export function getSmsConfig(): SmsConfig | null {
  const apiKey = process.env.SOLAPI_API_KEY;
  const apiSecret = process.env.SOLAPI_API_SECRET;
  const sender = (process.env.SOLAPI_SENDER ?? "").replace(/\D/g, "");
  if (!apiKey || !apiSecret || !sender) return null;
  return { apiKey, apiSecret, sender };
}

export function isSmsDevMode() {
  return getSmsConfig() === null;
}

/** SOLAPI HMAC-SHA256 인증 헤더. signature = HMAC(secret, date + salt) hex */
export function buildSolapiAuthHeader(
  apiKey: string,
  apiSecret: string,
  date: string = new Date().toISOString(),
  salt: string = randomBytes(16).toString("hex")
) {
  const signature = createHmac("sha256", apiSecret).update(date + salt).digest("hex");
  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
}

export class SmsSendError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string
  ) {
    super(`SOLAPI 발송 실패 (HTTP ${status}): ${body}`);
    this.name = "SmsSendError";
  }
}

export async function sendSms(
  to: string,
  text: string,
  config: SmsConfig | null = getSmsConfig()
) {
  if (!config) throw new Error("SOLAPI 설정이 없습니다. (SOLAPI_API_KEY / SOLAPI_API_SECRET / SOLAPI_SENDER)");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(SOLAPI_SEND_URL, {
      method: "POST",
      headers: {
        Authorization: buildSolapiAuthHeader(config.apiKey, config.apiSecret),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message: { to, from: config.sender, text } }),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new SmsSendError(res.status, await res.text().catch(() => ""));
    }
  } finally {
    clearTimeout(timer);
  }
}

/** 단문(SMS, 90바이트) 범위 안에서 유지한다 */
export function verificationSmsText(code: string) {
  return `[Optix] 회원가입 인증번호 ${code} (${VERIFICATION_TTL_MINUTES}분 유효)`;
}

export async function sendVerificationSms(phone: string, code: string) {
  const config = getSmsConfig();
  if (!config) {
    console.log(
      `[sms] SOLAPI 미설정 — 개발 모드. ${phone} 인증번호: ${code} (${VERIFICATION_TTL_MINUTES}분 유효)`
    );
    return;
  }
  await sendSms(phone, verificationSmsText(code), config);
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx tsx --test lib/sms.test.ts`
Expected: 10 tests pass.

- [ ] **Step 5: 커밋**

```powershell
git add lib/sms.ts lib/sms.test.ts
git commit -m "feat: SOLAPI 문자 발송 모듈 (HMAC-SHA256, 개발 모드 콘솔 출력)"
```

---

### Task 5: `lib/rate-limit.ts` — IP 발송 제한

**Files:**
- Create: `lib/rate-limit.ts`
- Test: `lib/rate-limit.test.ts`

**Interfaces:**
- Produces:
  - `checkRateLimit(key: string, limit: number, windowMs: number, now?: number): { ok: boolean; retryAfterSeconds: number }`
  - `resetRateLimits(): void` (테스트용)
  - `getClientIp(request: Request): string`

- [ ] **Step 1: 실패하는 테스트 작성**

`lib/rate-limit.test.ts`:

```ts
import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { checkRateLimit, resetRateLimits, getClientIp } from "./rate-limit";

const HOUR = 60 * 60 * 1000;

beforeEach(() => resetRateLimits());

describe("checkRateLimit", () => {
  test("한도 안에서는 ok", () => {
    for (let i = 0; i < 3; i++) {
      assert.deepEqual(checkRateLimit("ip:1", 3, HOUR, 1000 + i), { ok: true, retryAfterSeconds: 0 });
    }
  });

  test("한도를 넘기면 거부하고 대기 시간을 알려준다", () => {
    checkRateLimit("ip:1", 2, HOUR, 0);
    checkRateLimit("ip:1", 2, HOUR, 1000);
    const result = checkRateLimit("ip:1", 2, HOUR, 2000);
    assert.equal(result.ok, false);
    // 첫 호출(0ms) 기준 윈도우 만료까지 = 1시간 - 2초
    assert.equal(result.retryAfterSeconds, 3598);
  });

  test("윈도우가 지나면 다시 허용", () => {
    checkRateLimit("ip:1", 1, HOUR, 0);
    assert.equal(checkRateLimit("ip:1", 1, HOUR, 10).ok, false);
    assert.equal(checkRateLimit("ip:1", 1, HOUR, HOUR + 1).ok, true);
  });

  test("키가 다르면 서로 영향 없음", () => {
    checkRateLimit("ip:1", 1, HOUR, 0);
    assert.equal(checkRateLimit("ip:2", 1, HOUR, 0).ok, true);
  });
});

describe("getClientIp", () => {
  test("x-forwarded-for 첫 값을 쓴다", () => {
    const req = new Request("http://x", { headers: { "x-forwarded-for": "1.2.3.4, 10.0.0.1" } });
    assert.equal(getClientIp(req), "1.2.3.4");
  });

  test("없으면 x-real-ip, 그것도 없으면 unknown", () => {
    assert.equal(getClientIp(new Request("http://x", { headers: { "x-real-ip": "5.6.7.8" } })), "5.6.7.8");
    assert.equal(getClientIp(new Request("http://x")), "unknown");
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx tsx --test lib/rate-limit.test.ts`
Expected: FAIL — `Cannot find module './rate-limit'`

- [ ] **Step 3: 구현**

`lib/rate-limit.ts`:

```ts
/**
 * 프로세스 메모리 기반 고정 윈도우 제한.
 * 단일 컨테이너 운영이라 충분하다. 재시작하면 초기화된다.
 */
const buckets = new Map<string, number[]>();
const CLEANUP_THRESHOLD = 10_000;

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now()
): { ok: boolean; retryAfterSeconds: number } {
  const since = now - windowMs;
  const hits = (buckets.get(key) ?? []).filter((t) => t > since);

  if (hits.length >= limit) {
    buckets.set(key, hits);
    const retryAfterMs = hits[0] + windowMs - now;
    return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
  }

  hits.push(now);
  buckets.set(key, hits);

  if (buckets.size > CLEANUP_THRESHOLD) {
    for (const [k, v] of buckets) {
      if (!v.some((t) => t > since)) buckets.delete(k);
    }
  }
  return { ok: true, retryAfterSeconds: 0 };
}

export function resetRateLimits() {
  buckets.clear();
}

/** 리버스 프록시 뒤에서 실제 클라이언트 IP. 없으면 "unknown" */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx tsx --test lib/rate-limit.test.ts`
Expected: 6 tests pass.

- [ ] **Step 5: 커밋**

```powershell
git add lib/rate-limit.ts lib/rate-limit.test.ts
git commit -m "feat: in-memory IP 요청 제한 헬퍼"
```

---

### Task 6: 아이디 중복확인 API

**Files:**
- Create: `app/api/auth/check-username/route.ts`

**Interfaces:**
- Consumes: `usernameSchema` (Task 3), `prisma.user` with `username` (Task 1)
- Produces: `POST /api/auth/check-username` — 요청 `{ username: string }`, 응답 200 `{ available: boolean }`, 400 `{ error: string }`. Task 9의 폼이 호출한다.

- [ ] **Step 1: 구현**

`app/api/auth/check-username/route.ts`:

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { usernameSchema } from "@/lib/validators";

const schema = z.object({ username: usernameSchema });

/** 회원가입 아이디 중복확인. 존재 여부 외 다른 정보는 내보내지 않는다. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "입력값이 올바르지 않습니다." },
      { status: 400 }
    );
  }

  const exists = await prisma.user.findUnique({
    where: { username: parsed.data.username },
    select: { id: true },
  });

  return NextResponse.json({ available: !exists });
}
```

- [ ] **Step 2: 수동 검증**

DB가 떠 있고 시드가 들어간 상태에서 `npm run dev`를 백그라운드로 띄운 뒤:

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/auth/check-username -ContentType application/json -Body '{"username":"user"}'
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/auth/check-username -ContentType application/json -Body '{"username":"newbie01"}'
```
Expected: 첫 번째 `available: False`, 두 번째 `available: True`. `{"username":"Ab"}`는 400.
(다른 파일의 타입 오류로 dev 서버가 이 라우트를 컴파일 못 하면, Task 8까지 끝낸 뒤 이 검증을 다시 한다.)

- [ ] **Step 3: 커밋**

```powershell
git add app/api/auth/check-username/route.ts
git commit -m "feat: 회원가입 아이디 중복확인 API"
```

---

### Task 7: 인증번호 발송·회원가입 API를 phone 기준으로 전환

**Files:**
- Modify: `app/api/auth/send-verification/route.ts` (전체 교체)
- Modify: `app/api/auth/register/route.ts` (전체 교체)

**Interfaces:**
- Consumes: `phoneSchema`, `registerSchema` (Task 3), `sendVerificationSms`, `isSmsDevMode` (Task 4), `checkRateLimit`, `getClientIp` (Task 5), `prisma.phoneVerification` (Task 1)
- Produces:
  - `POST /api/auth/send-verification` — 요청 `{ phone }`, 응답 `{ ok, ttlMinutes, resendSeconds, devMode }` / 400 / 409 / 429 / 502
  - `POST /api/auth/register` — 요청 `{ username, name, phone, password, code }`, 응답 201 `{ ok: true }` / 400 / 409

- [ ] **Step 1: send-verification 교체**

`app/api/auth/send-verification/route.ts` 전체:

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendVerificationSms, isSmsDevMode } from "@/lib/sms";
import { phoneSchema } from "@/lib/validators";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import {
  RESEND_INTERVAL_MS,
  RESEND_INTERVAL_SECONDS,
  VERIFICATION_TTL_MS,
  VERIFICATION_TTL_MINUTES,
} from "@/lib/verification";

const schema = z.object({ phone: phoneSchema });

/** 문자는 건당 과금이므로 IP당 1시간 10건으로 제한한다 */
const SMS_IP_LIMIT = 10;
const SMS_IP_WINDOW_MS = 60 * 60 * 1000;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "입력값이 올바르지 않습니다." },
      { status: 400 }
    );
  }
  const phone = parsed.data.phone;

  const ipLimit = checkRateLimit(`sms:${getClientIp(request)}`, SMS_IP_LIMIT, SMS_IP_WINDOW_MS);
  if (!ipLimit.ok) {
    return NextResponse.json(
      { error: "인증번호 발송 한도를 초과했습니다. 잠시 후 다시 시도해 주세요." },
      { status: 429, headers: { "Retry-After": String(ipLimit.retryAfterSeconds) } }
    );
  }

  const exists = await prisma.user.findUnique({ where: { phone }, select: { id: true } });
  if (exists) {
    return NextResponse.json(
      { error: "이미 가입된 휴대폰 번호입니다." },
      { status: 409 }
    );
  }

  const existing = await prisma.phoneVerification.findUnique({ where: { phone } });
  if (existing && Date.now() - existing.createdAt.getTime() < RESEND_INTERVAL_MS) {
    return NextResponse.json(
      { error: `잠시 후 다시 요청해 주세요. (재발송은 ${RESEND_INTERVAL_SECONDS}초 간격)` },
      { status: 429 }
    );
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));

  await prisma.phoneVerification.upsert({
    where: { phone },
    update: {
      code,
      attempts: 0,
      expiresAt: new Date(Date.now() + VERIFICATION_TTL_MS),
      createdAt: new Date(),
    },
    create: {
      phone,
      code,
      expiresAt: new Date(Date.now() + VERIFICATION_TTL_MS),
    },
  });

  try {
    await sendVerificationSms(phone, code);
  } catch (e) {
    console.error("[send-verification] 문자 발송 실패:", e);
    return NextResponse.json(
      { error: "인증번호 발송에 실패했습니다. 잠시 후 다시 시도해 주세요." },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    ttlMinutes: VERIFICATION_TTL_MINUTES,
    resendSeconds: RESEND_INTERVAL_SECONDS,
    // SOLAPI 미설정 시 클라이언트에 알려 개발 모드 안내를 띄운다
    devMode: isSmsDevMode(),
  });
}
```

- [ ] **Step 2: register 교체**

`app/api/auth/register/route.ts` 전체:

```ts
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validators";
import { MAX_VERIFY_ATTEMPTS } from "@/lib/verification";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "입력값이 올바르지 않습니다." },
      { status: 400 }
    );
  }

  const { username, name, phone, password, code } = parsed.data;

  const usernameTaken = await prisma.user.findUnique({ where: { username }, select: { id: true } });
  if (usernameTaken) {
    return NextResponse.json({ error: "이미 사용 중인 아이디입니다." }, { status: 409 });
  }

  const phoneTaken = await prisma.user.findUnique({ where: { phone }, select: { id: true } });
  if (phoneTaken) {
    return NextResponse.json({ error: "이미 가입된 휴대폰 번호입니다." }, { status: 409 });
  }

  // 휴대폰 인증번호 검증
  const verification = await prisma.phoneVerification.findUnique({ where: { phone } });
  if (!verification) {
    return NextResponse.json(
      { error: "휴대폰 인증을 먼저 진행해 주세요." },
      { status: 400 }
    );
  }
  if (verification.expiresAt < new Date()) {
    return NextResponse.json(
      { error: "인증번호가 만료되었습니다. 다시 발송해 주세요." },
      { status: 400 }
    );
  }
  if (verification.attempts >= MAX_VERIFY_ATTEMPTS) {
    return NextResponse.json(
      { error: "인증 시도 횟수를 초과했습니다. 인증번호를 다시 발송해 주세요." },
      { status: 400 }
    );
  }
  if (verification.code !== code) {
    await prisma.phoneVerification.update({
      where: { phone },
      data: { attempts: { increment: 1 } },
    });
    return NextResponse.json({ error: "인증번호가 올바르지 않습니다." }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  try {
    await prisma.$transaction([
      prisma.user.create({ data: { username, phone, passwordHash, name } }),
      prisma.phoneVerification.delete({ where: { phone } }),
    ]);
  } catch (e) {
    // 중복확인과 가입 사이에 같은 아이디/번호가 먼저 가입된 경우
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json(
        { error: "이미 사용 중인 아이디 또는 휴대폰 번호입니다." },
        { status: 409 }
      );
    }
    throw e;
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
```

- [ ] **Step 3: 타입체크**

Run: `npx tsc --noEmit`
Expected: 이 두 파일에서는 오류 없음. 남은 오류는 auth.ts·program·orders·어드민·마이페이지·auth-forms·mailer 관련뿐이어야 한다.

- [ ] **Step 4: 수동 검증 (개발 모드)**

`.env`에 SOLAPI 값이 비어 있는 상태에서 dev 서버 실행 후:

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/auth/send-verification -ContentType application/json -Body '{"phone":"010-5555-6666"}'
```
Expected: `ok True, ttlMinutes 10, resendSeconds 60, devMode True`. 서버 콘솔에 `[sms] SOLAPI 미설정 — 개발 모드. 01055556666 인증번호: NNNNNN` 출력. 곧바로 한 번 더 호출하면 429. 그 콘솔 코드로:

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/auth/register -ContentType application/json -Body '{"username":"newbie01","name":"신규회원","phone":"01055556666","password":"password1","code":"NNNNNN"}'
```
Expected: `ok True`. 같은 요청 반복 시 409 `이미 사용 중인 아이디입니다.`
(dev 서버가 다른 파일 오류로 안 뜨면 Task 8 이후 재검증.)

- [ ] **Step 5: 커밋**

```powershell
git add app/api/auth/send-verification/route.ts app/api/auth/register/route.ts
git commit -m "feat: 회원가입 인증번호 발송·가입 API를 휴대폰 문자 인증으로 전환"
```

---

### Task 8: 로그인 식별자를 username으로 — NextAuth·프로그램 API·주문 API

**Files:**
- Modify: `auth.ts:7-38`
- Modify: `lib/program-jwt.ts:11-36`
- Modify: `app/api/program/login/route.ts` (전체 교체)
- Modify: `app/api/program/me/route.ts:20`
- Modify: `app/api/orders/route.ts:55-61, 93-99`
- Modify: `components/portone-checkout.tsx:11-17, 74-77`

**Interfaces:**
- Consumes: `loginSchema` (Task 3), `formatPhone` 불필요
- Produces:
  - `Session.user: { id, username, name, role }` — 이후 Task 9~11의 컴포넌트가 `session.user.username`을 쓸 수 있다. `session.user.email`은 더 이상 없다.
  - `ProgramTokenPayload { sub: string; username: string }`
  - `POST /api/orders` 응답 `{ orderId, amount, orderName, customerName, customerPhone }`

- [ ] **Step 1: auth.ts**

`auth.ts`의 `declare module` 블록과 `Credentials` provider, 콜백을 다음으로 바꾼다.

```ts
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      username: string;
      name: string;
      role: "USER" | "ADMIN";
    };
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { username: {}, password: {} },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { username: parsed.data.username },
        });
        if (!user || user.status !== "ACTIVE") return null;

        const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, username: user.username, name: user.name, role: user.role };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        const u = user as { id?: string; username: string; role: "USER" | "ADMIN" };
        token.id = u.id;
        token.username = u.username;
        token.role = u.role;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.username = token.username as string;
      session.user.role = token.role as "USER" | "ADMIN";
      return session;
    },
  },
});
```

- [ ] **Step 2: program-jwt.ts**

`lib/program-jwt.ts`의 payload 타입과 sign/verify를 바꾼다.

```ts
export interface ProgramTokenPayload {
  sub: string; // user id
  username: string;
}

export async function signProgramToken(payload: ProgramTokenPayload) {
  const token = await new SignJWT({ username: payload.username })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${EXPIRES_IN_SECONDS}s`)
    .sign(getSecret());
  return { token, expiresIn: EXPIRES_IN_SECONDS };
}

export async function verifyProgramToken(
  token: string
): Promise<ProgramTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (!payload.sub || typeof payload.username !== "string") return null;
    return { sub: payload.sub, username: payload.username };
  } catch {
    return null;
  }
}
```

- [ ] **Step 3: program/login**

`app/api/program/login/route.ts` 전체:

```ts
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validators";
import { signProgramToken } from "@/lib/program-jwt";

/** 데스크톱 프로그램 로그인: 웹사이트 계정(아이디/비밀번호)으로 인증 후 JWT 발급 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "아이디와 비밀번호를 입력해 주세요." },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { username: parsed.data.username },
  });
  if (!user) {
    return NextResponse.json(
      { error: "아이디 또는 비밀번호가 올바르지 않습니다." },
      { status: 401 }
    );
  }

  if (user.status === "SUSPENDED") {
    return NextResponse.json({ error: "정지된 계정입니다." }, { status: 403 });
  }

  const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!valid) {
    return NextResponse.json(
      { error: "아이디 또는 비밀번호가 올바르지 않습니다." },
      { status: 401 }
    );
  }

  const { token, expiresIn } = await signProgramToken({
    sub: user.id,
    username: user.username,
  });

  return NextResponse.json({
    accessToken: token,
    expiresIn,
    user: { id: user.id, username: user.username, name: user.name },
  });
}
```

- [ ] **Step 4: program/me**

`app/api/program/me/route.ts` 마지막 줄을 바꾼다.

```ts
  return NextResponse.json({ id: user.id, username: user.username, name: user.name });
```

- [ ] **Step 5: orders API**

`app/api/orders/route.ts`에서 세션 확인 직후(`if (!session) {...}` 다음)에 회원 phone을 읽는다.

```ts
  const customer = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { phone: true },
  });
  if (!customer) {
    return NextResponse.json({ error: "계정을 찾을 수 없습니다." }, { status: 401 });
  }
```

그리고 두 곳의 응답에서 `customerEmail: session.user.email,` 을 `customerPhone: customer.phone,` 으로 바꾼다.

- [ ] **Step 6: portone-checkout.tsx**

`orderRef` 타입의 `customerEmail: string;` → `customerPhone: string;`, `requestPayment`의 customer를:

```ts
        customer: {
          fullName: order.customerName,
          phoneNumber: order.customerPhone,
        },
```

- [ ] **Step 7: 타입체크**

Run: `npx tsc --noEmit`
Expected: 남은 오류는 `components/auth-forms.tsx`(signIn email), `app/mypage/*`, `app/admin/*`, `components/admin-billing-forms.tsx`, `lib/mailer.ts`(nodemailer 유지 중이라 아직 오류 없을 수 있음) 관련뿐.

- [ ] **Step 8: 프로그램 API 수동 검증**

```powershell
$r = Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/program/login -ContentType application/json -Body '{"username":"user","password":"test1234!"}'
$r.user
Invoke-RestMethod -Uri http://localhost:3000/api/program/me -Headers @{ Authorization = "Bearer $($r.accessToken)" }
```
Expected: 로그인 응답 `user.username = user`, me 응답 `{ id, username: "user", name: "테스트회원" }`.

- [ ] **Step 9: 커밋**

```powershell
git add auth.ts lib/program-jwt.ts app/api/program/login/route.ts app/api/program/me/route.ts app/api/orders/route.ts components/portone-checkout.tsx
git commit -m "feat: 로그인·프로그램 JWT·주문 고객정보를 아이디/휴대폰 기준으로 전환"
```

---

### Task 9: 회원가입·로그인 폼

**Files:**
- Modify: `components/auth-forms.tsx` (전체 교체)

**Interfaces:**
- Consumes: `POST /api/auth/check-username` (Task 6), `POST /api/auth/send-verification`·`/register` (Task 7), `signIn("credentials", { username, password })` (Task 8)

- [ ] **Step 1: 파일 교체**

`components/auth-forms.tsx` 전체:

```tsx
"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";

const inputClass =
  "w-full rounded-lg border border-line bg-surface-2 px-4 py-3 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none";
const sideButtonClass =
  "shrink-0 rounded-lg border border-accent/60 px-4 py-3 text-sm font-medium text-accent transition hover:bg-accent/10 disabled:opacity-50";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/mypage";
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const result = await signIn("credentials", {
      username: form.get("username"),
      password: form.get("password"),
      redirect: false,
    });
    setLoading(false);
    if (result?.error) {
      setError("아이디 또는 비밀번호가 올바르지 않거나 정지된 계정입니다.");
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <input
        name="username"
        type="text"
        autoComplete="username"
        autoCapitalize="none"
        required
        placeholder="아이디"
        className={inputClass}
      />
      <input name="password" type="password" autoComplete="current-password" required placeholder="비밀번호" className={inputClass} />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-accent py-3 font-medium text-white transition hover:bg-accent/80 disabled:opacity-50"
      >
        {loading ? "로그인 중..." : "로그인"}
      </button>
      <p className="text-center text-sm text-muted">
        아직 계정이 없으신가요?{" "}
        <Link href="/register" className="text-accent hover:underline">
          회원가입
        </Link>
      </p>
    </form>
  );
}

type UsernameStatus = "idle" | "checking" | "available" | "unavailable";

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 아이디 중복확인
  const [username, setUsername] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle");
  const [usernameMessage, setUsernameMessage] = useState<string | null>(null);

  // 휴대폰 인증
  const [sending, setSending] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  /** 인증번호 남은 유효시간(초) */
  const [expiresIn, setExpiresIn] = useState(0);

  function startExpiry(seconds: number) {
    setExpiresIn(seconds);
    const timer = setInterval(() => {
      setExpiresIn((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function startCooldown(seconds: number) {
    setCooldown(seconds);
    const timer = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function handleUsernameChange(e: React.ChangeEvent<HTMLInputElement>) {
    setUsername(e.target.value);
    // 값이 바뀌면 이전 확인 결과는 무효
    setUsernameStatus("idle");
    setUsernameMessage(null);
  }

  async function handleCheckUsername() {
    setError(null);
    const value = username.trim().toLowerCase();
    if (!value) {
      setUsernameStatus("unavailable");
      setUsernameMessage("아이디를 입력해 주세요.");
      return;
    }

    setUsernameStatus("checking");
    const res = await fetch("/api/auth/check-username", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: value }),
    });
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      setUsernameStatus("unavailable");
      setUsernameMessage(data?.error ?? "아이디를 확인하지 못했습니다.");
      return;
    }
    if (data?.available) {
      setUsername(value);
      setUsernameStatus("available");
      setUsernameMessage("사용 가능한 아이디입니다.");
    } else {
      setUsernameStatus("unavailable");
      setUsernameMessage("이미 사용 중인 아이디입니다.");
    }
  }

  async function handleSendCode(e: React.MouseEvent<HTMLButtonElement>) {
    const form = e.currentTarget.closest("form");
    const phone = (form?.elements.namedItem("phone") as HTMLInputElement)?.value;
    setError(null);
    setNotice(null);

    if (!phone || phone.replace(/\D/g, "").length < 10) {
      setError("휴대폰 번호를 먼저 입력해 주세요.");
      return;
    }

    setSending(true);
    const res = await fetch("/api/auth/send-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    setSending(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "인증번호 발송에 실패했습니다.");
      return;
    }

    const data = await res.json().catch(() => null);
    const ttlMinutes: number = data?.ttlMinutes ?? 10;
    setCodeSent(true);
    setNotice(
      data?.devMode
        ? `개발 모드: SOLAPI가 설정되지 않아 문자 대신 서버 콘솔에 인증번호가 출력됩니다. (${ttlMinutes}분 유효)`
        : `인증번호를 문자로 발송했습니다. ${ttlMinutes}분 안에 입력해 주세요.`
    );
    startCooldown(data?.resendSeconds ?? 60);
    startExpiry(ttlMinutes * 60);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = new FormData(e.currentTarget);
    const name = form.get("name") as string;
    const phone = form.get("phone") as string;
    const password = form.get("password") as string;
    const passwordConfirm = form.get("passwordConfirm") as string;
    const code = form.get("code") as string;

    if (usernameStatus !== "available") {
      setError("아이디 중복확인을 해 주세요.");
      return;
    }
    if (password !== passwordConfirm) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }
    if (!code) {
      setError("문자로 받은 인증번호를 입력해 주세요.");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, name, phone, password, code }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "회원가입에 실패했습니다.");
      setLoading(false);
      return;
    }

    await signIn("credentials", { username, password, redirect: false });
    setLoading(false);
    router.push("/mypage");
    router.refresh();
  }

  const canSubmit = usernameStatus === "available" && codeSent && !loading;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <div className="flex gap-2">
          <input
            name="username"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            required
            minLength={4}
            maxLength={20}
            value={username}
            onChange={handleUsernameChange}
            placeholder="아이디 (영문 소문자·숫자 4~20자)"
            className={inputClass}
          />
          <button
            type="button"
            onClick={handleCheckUsername}
            disabled={usernameStatus === "checking" || usernameStatus === "available"}
            className={sideButtonClass}
          >
            {usernameStatus === "checking"
              ? "확인 중..."
              : usernameStatus === "available"
                ? "확인 완료"
                : "중복확인"}
          </button>
        </div>
        {usernameMessage && (
          <p
            className={`mt-2 text-xs ${
              usernameStatus === "available" ? "text-accent" : "text-red-400"
            }`}
          >
            {usernameMessage}
          </p>
        )}
      </div>

      <input name="name" type="text" autoComplete="name" required placeholder="이름" className={inputClass} />

      <div className="flex gap-2">
        <input
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required
          placeholder="휴대폰 번호 (010-0000-0000)"
          className={inputClass}
        />
        <button
          type="button"
          onClick={handleSendCode}
          disabled={sending || cooldown > 0}
          className={sideButtonClass}
        >
          {sending
            ? "발송 중..."
            : cooldown > 0
              ? `재발송 (${cooldown}s)`
              : codeSent
                ? "재발송"
                : "인증번호 발송"}
        </button>
      </div>
      {codeSent && (
        <div className="relative">
          <input
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
            placeholder="인증번호 6자리"
            className={`${inputClass} w-full pr-24`}
          />
          <span
            className={`pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs ${
              expiresIn > 0 ? "text-muted" : "text-red-400"
            }`}
          >
            {expiresIn > 0
              ? `유효 ${Math.floor(expiresIn / 60)}:${String(expiresIn % 60).padStart(2, "0")}`
              : "만료됨 · 재발송 필요"}
          </span>
        </div>
      )}
      {notice && <p className="text-sm text-accent">{notice}</p>}

      <input
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        placeholder="비밀번호 (8자 이상)"
        className={inputClass}
      />
      <input
        name="passwordConfirm"
        type="password"
        autoComplete="new-password"
        required
        placeholder="비밀번호 확인"
        className={inputClass}
      />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={!canSubmit}
        className="rounded-lg bg-accent py-3 font-medium text-white transition hover:bg-accent/80 disabled:opacity-50"
      >
        {loading ? "가입 중..." : "회원가입"}
      </button>
      <p className="text-center text-sm text-muted">
        이미 계정이 있으신가요?{" "}
        <Link href="/login" className="text-accent hover:underline">
          로그인
        </Link>
      </p>
    </form>
  );
}
```

- [ ] **Step 2: 타입체크·린트**

Run: `npx tsc --noEmit; npx eslint components/auth-forms.tsx`
Expected: 이 파일 오류 0.

- [ ] **Step 3: 브라우저 수동 검증**

dev 서버에서 `/register` 접속:
1. 아이디 `user` 입력 → 중복확인 → 빨간 "이미 사용 중인 아이디입니다." 가입 버튼 비활성.
2. 아이디를 `tester99`로 바꾸면 메시지 사라지고 버튼이 "중복확인"으로 복귀 → 클릭 → "사용 가능한 아이디입니다.", 버튼 "확인 완료".
3. 휴대폰 `010-7777-8888` → 인증번호 발송 → 개발 모드 안내, 서버 콘솔 코드 확인, 재발송 버튼 60초 카운트다운.
4. 코드·비밀번호 입력 → 회원가입 → `/mypage`로 이동.
5. 로그아웃 후 `/login`에서 `tester99` / 비밀번호로 로그인 성공.

- [ ] **Step 4: 커밋**

```powershell
git add components/auth-forms.tsx
git commit -m "feat: 회원가입 폼 아이디 중복확인·휴대폰 문자 인증, 로그인 폼 아이디 입력"
```

---

### Task 10: 마이페이지 표시·탈퇴 익명화

**Files:**
- Modify: `app/mypage/page.tsx:56-72`
- Modify: `app/mypage/actions.ts:103-111`

**Interfaces:**
- Consumes: `formatPhone` (Task 2), `User.username/phone` (Task 1)

- [ ] **Step 1: 마이페이지 내 정보**

`app/mypage/page.tsx` 상단 import에 추가:

```ts
import { formatPhone } from "@/lib/phone";
```

`<dl>` 내용을 다음으로 교체:

```tsx
        <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
          <div className="flex gap-4">
            <dt className="w-16 text-muted">아이디</dt>
            <dd>{user.username}</dd>
          </div>
          <div className="flex gap-4">
            <dt className="w-16 text-muted">이름</dt>
            <dd>{user.name}</dd>
          </div>
          <div className="flex gap-4">
            <dt className="w-16 text-muted">휴대폰</dt>
            <dd>{formatPhone(user.phone)}</dd>
          </div>
          <div className="flex gap-4">
            <dt className="w-16 text-muted">가입일</dt>
            <dd>{user.createdAt.toLocaleDateString("ko-KR")}</dd>
          </div>
        </dl>
        <p className="mt-4 text-xs text-muted">
          프로그램 로그인 시 위 아이디와 비밀번호를 동일하게 사용합니다.
        </p>
```

- [ ] **Step 2: 탈퇴 익명화**

`app/mypage/actions.ts`의 `prisma.user.update` data를:

```ts
    data: {
      status: "WITHDRAWN",
      username: `withdrawn-${user.id}`,
      phone: `withdrawn-${user.id}`,
      email: null,
      name: "탈퇴회원",
      passwordHash: "",
    },
```

- [ ] **Step 3: 타입체크**

Run: `npx tsc --noEmit`
Expected: `app/mypage/*` 오류 0.

- [ ] **Step 4: 수동 검증**

`/mypage`에서 아이디·휴대폰이 `010-7777-8888` 형식으로 보이는지 확인.

- [ ] **Step 5: 커밋**

```powershell
git add app/mypage/page.tsx app/mypage/actions.ts
git commit -m "feat: 마이페이지 아이디·휴대폰 표시, 탈퇴 시 아이디·휴대폰 익명화"
```

---

### Task 11: 어드민 화면·약관 문구 email → username/phone

**Files:**
- Modify: `app/admin/users/page.tsx:26, 56, 73, 97`
- Modify: `app/admin/orders/page.tsx:30, 115`
- Modify: `app/admin/billing/page.tsx:33, 47, 109, 149, 197`
- Modify: `app/admin/page.tsx:126`
- Modify: `components/admin-billing-forms.tsx:55, 80`
- Modify: `app/terms/page.tsx:20`
- Modify: `app/privacy/page.tsx:8`

**Interfaces:**
- Consumes: `formatPhone` (Task 2), `User.username/phone` (Task 1)

- [ ] **Step 1: 회원관리 페이지**

`app/admin/users/page.tsx`:
- import 추가: `import { formatPhone } from "@/lib/phone";`
- 검색 조건(26행):
  ```ts
  OR: [
    { username: { contains: q } },
    { name: { contains: q } },
    { phone: { contains: q.replace(/\D/g, "") || q } },
  ],
  ```
- placeholder(56행): `"이름/아이디/휴대폰 검색"`
- 헤더(73행): `<th className="p-4 font-normal">이메일</th>` → `<th className="p-4 font-normal">아이디</th>` 바로 뒤에 `<th className="p-4 font-normal">휴대폰</th>` 추가.
- 셀(97행): `<td className="p-4 text-muted">{user.email}</td>` → 
  ```tsx
  <td className="p-4 font-mono text-xs">{user.username}</td>
  <td className="p-4 text-muted">{formatPhone(user.phone)}</td>
  ```
- 빈 결과 `colSpan={8}` → `colSpan={9}`.

- [ ] **Step 2: 주문내역 페이지**

`app/admin/orders/page.tsx`:
- 30행 `{ user: { email: { contains: q } } },` → `{ user: { username: { contains: q } } },`
- 115행 `{order.user.email}` → `{order.user.username}`

- [ ] **Step 3: 월결제 페이지·폼**

`app/admin/billing/page.tsx`:
- 33행 `{ user: { email: { contains: q } } },` → `{ user: { username: { contains: q } } },`
- 47행 select에서 `email: true` → `username: true`
- 109행 placeholder `"이름/아이디/항목 검색"`
- 149행 `{inv.user.email}` → `{inv.user.username}`
- 197행 `encodeURIComponent(inv.user.email)` → `encodeURIComponent(inv.user.username)`

`components/admin-billing-forms.tsx`:
- 55행 `email: string;` → `username: string;`
- 80행 `{user.name} ({user.email})` → `{user.name} ({user.username})`

- [ ] **Step 4: 대시보드**

`app/admin/page.tsx` 126행 `{user.email}` → `{user.username}`

- [ ] **Step 5: 약관·개인정보 문구**

`app/terms/page.tsx` 20행 body 앞부분:
`"회원가입은 아이디, 휴대폰 번호(문자 인증), 비밀번호를 등록하는 방식으로 이루어집니다. ..."` (뒷문장은 그대로)

`app/privacy/page.tsx` 8행 body의 `필수항목: 이메일 주소, 비밀번호(암호화 저장), 이름.` → `필수항목: 아이디, 휴대폰 번호, 비밀번호(암호화 저장), 이름.`

- [ ] **Step 6: 타입체크·린트**

Run: `npx tsc --noEmit; npm run lint`
Expected: `lib/mailer.ts`를 제외하고 오류 0 (mailer는 nodemailer가 아직 설치돼 있어 오류가 없을 수도 있다).

- [ ] **Step 7: 수동 검증**

admin(`admin` / `admin1234!`)으로 로그인 후 `/admin/users`에서 아이디·휴대폰 컬럼 표시와 `7777` 검색으로 tester99가 나오는지 확인. `/admin/orders`, `/admin/billing` 렌더 확인.

- [ ] **Step 8: 커밋**

```powershell
git add app/admin/users/page.tsx app/admin/orders/page.tsx app/admin/billing/page.tsx app/admin/page.tsx components/admin-billing-forms.tsx app/terms/page.tsx app/privacy/page.tsx
git commit -m "feat: 어드민 회원 식별을 아이디·휴대폰으로, 약관·개인정보 문구 갱신"
```

---

### Task 12: 메일 잔재 제거, SMS 점검 스크립트, 환경변수·문서, 최종 검증

**Files:**
- Delete: `lib/mailer.ts`, `scripts/send-test-mail.mjs`
- Create: `scripts/send-test-sms.mjs`
- Modify: `package.json:10-11, 19, 28`
- Modify: `.env.example:17-26`, `.env.production.example:22-33`, `.env:22-29`
- Modify: `docker-compose.yml:54-59`
- Modify: `README.md:4, 13, 36, 41-46, 48-58, 76, 81, 86-97`

- [ ] **Step 1: 메일 모듈·스크립트 삭제**

```powershell
git rm lib/mailer.ts scripts/send-test-mail.mjs
```

- [ ] **Step 2: SMS 점검 스크립트**

`scripts/send-test-sms.mjs`:

```js
/**
 * SOLAPI 발송 점검 스크립트.
 *   npm run sms:test -- 01012345678
 * .env의 SOLAPI_* 값으로 테스트 문자 1건을 보낸다.
 * lib/sms.ts와 동일한 인증 방식이므로, 여기서 성공하면 회원가입 인증 문자도 발송된다.
 */
import { createHmac, randomBytes } from "node:crypto";

const to = (process.argv[2] ?? "").replace(/\D/g, "");
if (!/^010\d{8}$/.test(to)) {
  console.error("사용법: npm run sms:test -- 01012345678");
  process.exit(1);
}

const { SOLAPI_API_KEY, SOLAPI_API_SECRET, SOLAPI_SENDER } = process.env;
const sender = (SOLAPI_SENDER ?? "").replace(/\D/g, "");

if (!SOLAPI_API_KEY || !SOLAPI_API_SECRET || !sender) {
  console.error(
    "SOLAPI_API_KEY / SOLAPI_API_SECRET / SOLAPI_SENDER가 설정되지 않았습니다. .env를 채워 주세요.\n" +
      "현재 상태에서는 회원가입 인증번호가 문자로 발송되지 않고 서버 콘솔에만 출력됩니다."
  );
  process.exit(1);
}

const date = new Date().toISOString();
const salt = randomBytes(16).toString("hex");
const signature = createHmac("sha256", SOLAPI_API_SECRET).update(date + salt).digest("hex");

console.log(`SOLAPI 발송 시도... from=${sender} to=${to}`);
const res = await fetch("https://api.solapi.com/messages/v4/send", {
  method: "POST",
  headers: {
    Authorization: `HMAC-SHA256 apiKey=${SOLAPI_API_KEY}, date=${date}, salt=${salt}, signature=${signature}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    message: {
      to,
      from: sender,
      text: `[Optix] SOLAPI 발송 테스트 ${new Date().toLocaleString("ko-KR")}`,
    },
  }),
});

const body = await res.text();
if (!res.ok) {
  console.error(`✖ 발송 실패 (HTTP ${res.status}): ${body}`);
  console.error("  - API 키/시크릿 확인\n  - 발신번호가 SOLAPI 콘솔에 등록·승인됐는지 확인\n  - 잔액 확인");
  process.exit(1);
}
console.log(`✔ 발송 성공 → ${to}`);
console.log(`  응답: ${body}`);
```

- [ ] **Step 3: package.json**

- `"test": "tsx --test lib/portone.test.ts"` → `"test": "tsx --test lib/portone.test.ts lib/phone.test.ts lib/validators.test.ts lib/sms.test.ts lib/rate-limit.test.ts"`
- `"mail:test": "node --env-file=.env scripts/send-test-mail.mjs"` → `"sms:test": "node --env-file=.env scripts/send-test-sms.mjs"`
- dependencies에서 `"nodemailer": "^8.0.11",` 삭제, devDependencies에서 `"@types/nodemailer": "^8.0.1",` 삭제.

그 다음:
```powershell
npm uninstall nodemailer @types/nodemailer
```
Expected: package-lock.json 갱신, `node_modules/nodemailer` 제거. (`"package-lock copy.json"`은 이 작업과 무관한 untracked 파일이므로 건드리지 않는다.)

- [ ] **Step 4: 환경변수 파일**

`.env.example` 17~26행을:

```
# 회원가입 휴대폰 인증 문자 (SOLAPI, ito_lineage_macro_web과 같은 계정)
# 미설정 시 문자 대신 서버 콘솔에 인증번호 출력
# 발신번호(SOLAPI_SENDER)는 SOLAPI 콘솔에서 사전 등록·승인 필요
SOLAPI_API_KEY=
SOLAPI_API_SECRET=
SOLAPI_SENDER=
# 발송 점검: npm run sms:test -- 01012345678
```

`.env.production.example` 22~28행을:

```
# 회원가입 휴대폰 인증 문자 (SOLAPI). 미설정 시 발송 대신 서버 로그에 인증번호 출력 — 운영에서는 반드시 설정
# 발신번호는 SOLAPI 콘솔에 사전 등록·승인된 번호
SOLAPI_API_KEY=change-me-solapi-api-key
SOLAPI_API_SECRET=change-me-solapi-api-secret
SOLAPI_SENDER=01000000000
```

같은 파일 32행 `시드로 생성되는 관리자(admin@goodautosystems.com)` → `시드로 생성되는 관리자(아이디 admin)`.

`.env`(로컬, git 미추적) 22~29행도 같은 SOLAPI 블록(빈 값)으로 교체한다.

- [ ] **Step 5: docker-compose.yml**

54~59행 SMTP 6줄을:

```yaml
      SOLAPI_API_KEY: ${SOLAPI_API_KEY:-}
      SOLAPI_API_SECRET: ${SOLAPI_API_SECRET:-}
      SOLAPI_SENDER: ${SOLAPI_SENDER:-}
```

- [ ] **Step 6: README**

- 4행: `회원가입/로그인` → `회원가입(휴대폰 문자 인증)/로그인`
- 13행 아래에 `- SOLAPI — 회원가입 휴대폰 인증 문자 발송` 추가
- 36행: `관리자 계정(\`admin@goodautosystems.com\`, 비밀번호는 \`SEED_ADMIN_PASSWORD\`)` → `관리자 계정(아이디 \`admin\`, 비밀번호는 \`SEED_ADMIN_PASSWORD\`)`
- 시드 계정 표:
  ```
  | 구분 | 아이디 | 비밀번호 | 휴대폰 |
  |------|--------|----------|--------|
  | 관리자 | admin | admin1234! | 010-0000-0001 |
  | 일반회원 | user | test1234! | 010-0000-0002 |
  ```
- 환경 변수 표에 추가:
  ```
  | `SOLAPI_API_KEY` / `SOLAPI_API_SECRET` | 솔라피 API 키 (회원가입 인증 문자). 미설정 시 서버 콘솔에 인증번호 출력 |
  | `SOLAPI_SENDER` | 솔라피 콘솔에 등록된 발신번호 |
  ```
- 76행: `auth/register           회원가입` → 
  ```
      auth/check-username     아이디 중복확인
      auth/send-verification  휴대폰 인증번호 문자 발송 (SOLAPI, IP당 1시간 10건)
      auth/register           회원가입 (인증번호 검증)
  ```
- 81행: `lib/                        prisma, portone, program-jwt, validators` → `lib/                        prisma, portone, sms(SOLAPI), phone, rate-limit, program-jwt, validators`
- 데스크톱 프로그램 인증 API 절:
  ```
  프로그램은 웹사이트 계정(아이디/비밀번호)으로 로그인합니다.

  | 메서드 | 경로 | 설명 |
  |--------|------|------|
  | POST | `/api/program/login` | `{username, password}` → `{accessToken(7일), expiresIn, user{id, username, name}}` |
  | GET | `/api/program/me` | `Authorization: Bearer <token>` → `{id, username, name}` |
  | GET | `/api/program/license?product=<slug>` | 구매 여부 `{licensed, product, expiresAt}` |

  - 401: 인증 실패/토큰 무효 · 403: 정지된 계정
  - 프로그램 시작 시 `license` API로 사용권을 확인하세요. (단건 구매 = 영구 사용권, `expiresAt: null`)
  - **2026-09 변경:** 로그인 요청 본문이 `{email, password}`에서 `{username, password}`로 바뀌었습니다. 프로그램 로그인 화면은 이메일 대신 아이디를 받아야 합니다.
  ```
- 회원가입 인증 절 추가(환경 변수 표 아래):
  ```
  ## 회원가입 휴대폰 인증

  - 아이디(영문 소문자 시작, 소문자·숫자·밑줄 4~20자) 중복확인 → 휴대폰 번호로 6자리 인증번호 문자 발송 → 코드 검증 후 가입
  - 인증번호 10분 유효, 재발송 60초 간격, 입력 5회 제한, IP당 1시간 10건 발송 제한
  - `SOLAPI_*`가 비어 있으면 문자 대신 서버 콘솔에 인증번호가 출력됩니다(로컬 개발용). 발송 점검: `npm run sms:test -- 01012345678`
  ```

- [ ] **Step 7: 전체 검증**

Run (PowerShell, 순서대로):
```powershell
npm test
npx tsc --noEmit
npm run lint
npm run build
```
Expected: 테스트 전부 pass, tsc 오류 0, lint 오류 0, build 성공. 실패하면 원인을 고치고 다시 실행한다. `grep -rn "emailVerification\|sendVerificationEmail\|nodemailer\|SMTP_" --include=*.ts --include=*.tsx --include=*.yml --include=*.md .` (node_modules, .next 제외) 결과가 없어야 한다 — Grep 툴로 `emailVerification|sendVerificationEmail|nodemailer|SMTP_` 검색.

- [ ] **Step 8: 브라우저 E2E 재확인**

`npm run dev` 후 가입(새 아이디·새 번호) → 로그인 → 마이페이지 → 어드민 회원관리까지 한 번 더 돌린다. Task 9 Step 3 시나리오와 동일.

- [ ] **Step 9: 커밋**

```powershell
git add package.json package-lock.json scripts/send-test-sms.mjs .env.example .env.production.example docker-compose.yml README.md
git commit -m "refactor: 메일 인증 잔재 제거, SOLAPI 환경변수·점검 스크립트·문서 정리"
```
(`git rm`한 두 파일은 이미 staged 상태다.)

---

## Self-Review 결과

- **Spec coverage:** 데이터 모델(T1), 아이디·휴대폰 규칙(T2·T3), SMS 모듈·점검 스크립트(T4·T12), IP 제한(T5·T7), check-username(T6), send-verification·register(T7), program login/me·JWT·orders·portone(T8), auth.ts(T8), 회원가입·로그인 폼(T9), 마이페이지·탈퇴(T10), 어드민·약관(T11), 환경변수·docker·README·의존성 제거(T12), 테스트 4종(T2~T5). 누락 없음.
- **Type consistency:** `customerPhone`(T8 orders ↔ portone-checkout), `usernameSchema`/`phoneSchema`/`loginSchema`(T3 ↔ T6·T7·T8), `sendVerificationSms`/`isSmsDevMode`(T4 ↔ T7), `checkRateLimit`/`getClientIp`(T5 ↔ T7), `formatPhone`(T2 ↔ T10·T11), `ProgramTokenPayload.username`(T8 내부) 일치.
- **Placeholder scan:** 없음.
