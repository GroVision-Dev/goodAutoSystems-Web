# 단건 결제 요청(비회원 결제) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 관리자가 비회원에게 항목명·금액을 직접 입력한 결제 요청 링크를 문자로 보내고, 고객이 로그인 없이 포트원 카드 결제를 하도록 한다.

**Architecture:** 새 `PaymentRequest` 테이블이 요청(받는 분·항목·금액·토큰·상태)을 보관하고, 실제 결제는 기존 `Order`(userId nullable + paymentRequestId)로 만든다. 결제 검증·웹훅·중복 환불·관리자 환불은 기존 `lib/payment-sync.ts`와 `app/optix-dev/actions.ts`를 확장해 재사용한다. 공개 결제 페이지 `/pay/[token]`과 주문 API `/api/pay/[token]/order`가 비회원 진입점이다.

**Tech Stack:** Next.js 16.3.5 (App Router, Server Actions), Prisma 6 + PostgreSQL, zod 4, @portone/browser-sdk v2, SOLAPI 문자, node:test + tsx

**Spec:** `docs/superpowers/specs/2026-09-15-payment-requests-design.md`

## Global Constraints

- Next.js 16은 학습 데이터와 API가 다를 수 있다. 낯선 API는 `node_modules/next/dist/docs/`를 먼저 읽는다.
- 셸은 PowerShell 5.1 (`;`로 연결, `&&` 금지). Bash 도구는 멈추는 경우가 있어 쓰지 않는다.
- 개발 서버 포트 12000, 로컬 DB는 docker `goodautosystems-web-db-1` (호스트 12002). `npx prisma db push --force-reset` 금지.
- 금액 범위 100 ~ 100,000,000원, 항목명 1~60자, 메모 200자, 받는 분 이름 2~40자, 휴대폰 `010XXXXXXXX`
- 유효기간 기본 7일, 최대 30일
- 토큰: `randomBytes(32).toString("base64url")` (43자), 형식 `^[A-Za-z0-9_-]{43}$`
- 결제수단은 카드(`payMethod: "CARD"`)만
- 모든 관리자 서버 액션 첫 줄 `requireAdmin()`, 관리자 페이지 첫 줄 `requireAdminPage()` (`lib/auth-guard.ts`)
- 결제 금액은 항상 DB 값으로 확정하고 `syncPaymentFromPortOne`으로 재검증 (클라이언트 금액 불신)
- `lib/payment-request.ts`는 `node:crypto`를 쓰므로 클라이언트 컴포넌트에서 import 금지
- UI 문구·주석은 한국어, 기존 코드 스타일(2칸 들여쓰기, 큰따옴표) 유지
- 커밋 메시지 끝에 아래 두 줄을 넣는다. PowerShell에서는 메시지를 파일로 쓰고 `git commit -F <파일>`로 커밋한다.
  ```
  Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01U7vPTZCh7smXXofx6zoUAA
  ```

## File Structure

| 파일 | 역할 |
|---|---|
| `prisma/schema.prisma` (수정) | `PaymentRequest` 모델, `PaymentRequestStatus` enum, `Order.userId` nullable + `paymentRequestId` |
| `lib/payment-request.ts` (신규) | 토큰·마스킹·문자 문구·생성 스키마·상태 계산·표시 라벨 (순수 로직) |
| `lib/payment-request.test.ts` (신규) | 위 순수 로직 단위 테스트 |
| `lib/order-id.ts` (신규) | 주문번호 생성 `newOrderId()` (회원·비회원 주문 API 공용) |
| `lib/order-expiry.ts` (수정) | `expireStalePaymentRequests()` 추가 |
| `lib/maintenance.ts` (수정) | 정기 작업에 결제 요청 만료 추가 |
| `lib/payment-sync.ts` (수정) | 결제 요청 PAID 전환·중복 환불·취소 동기화, userId null 처리 |
| `lib/audit.ts` (수정) | 결제 요청 감사 이벤트 |
| `app/optix-dev/actions.ts` (수정) | 관리자 결제취소 시 요청 REFUNDED |
| `app/optix-dev/orders/page.tsx`, `app/optix-dev/page.tsx` (수정) | 비회원 주문 표시 |
| `app/optix-dev/payment-requests/actions.ts` (신규) | 생성·재발송·취소 서버 액션 |
| `app/optix-dev/payment-requests/page.tsx` (신규) | 관리자 단건 결제 화면 |
| `components/admin-payment-request-form.tsx` (신규) | 생성 폼 (client) |
| `components/admin-payment-request-actions.tsx` (신규) | 링크 복사·재발송 버튼 (client) |
| `components/admin-nav.tsx` (수정) | "단건 결제" 메뉴 |
| `app/api/pay/[token]/order/route.ts` (신규) | 비회원 주문 생성 API |
| `app/api/orders/route.ts` (수정) | `newOrderId`를 `lib/order-id.ts`에서 import |
| `app/pay/[token]/page.tsx` (신규) | 고객 결제 페이지 |
| `app/pay/[token]/complete/page.tsx` (신규) | 결제 결과 검증 페이지 |
| `components/payment-request-checkout.tsx` (신규) | 이메일·동의 입력 + 포트원 결제창 (client) |
| `next.config.ts`, `app/robots.ts`, `app/privacy/page.tsx` (수정) | 캐시 금지·수집 제외·개인정보처리방침 |
| `package.json` (수정) | test 스크립트에 새 테스트 추가 |

---

### Task 1: 스키마 + 결제 요청 순수 로직

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `lib/payment-request.ts`
- Test: `lib/payment-request.test.ts`
- Modify: `package.json` (test 스크립트)

**Interfaces:**
- Consumes: `phoneSchema` (`lib/validators.ts`)
- Produces:
  - `PAYMENT_REQUEST_DEFAULT_DAYS = 7`, `PAYMENT_REQUEST_MAX_DAYS = 30`, `PAYMENT_REQUEST_TOKEN_RE`
  - `generatePaymentRequestToken(): string`
  - `isValidPaymentRequestToken(token: string): boolean`
  - `maskName(name: string): string`
  - `paymentRequestSmsText(input: { recipientName: string; title: string; amount: number; url: string }): string`
  - `paymentRequestCreateSchema` → `{ recipientName: string; recipientPhone: string; title: string; amount: number; memo: string | null; validDays: number }`
  - `paymentRequestExpiresAt(validDays: number, now?: Date): Date`
  - `type PaymentRequestView = "payable" | "paid" | "canceled" | "expired" | "refunded"`
  - `paymentRequestView(request: { status: PaymentRequestStatus; expiresAt: Date }, now?: Date): PaymentRequestView`
  - `PAYMENT_REQUEST_VIEW_MESSAGE: Record<Exclude<PaymentRequestView, "payable">, string>`
  - `PAYMENT_REQUEST_STATUS_LABEL: Record<PaymentRequestView, { label: string; className: string }>`
  - Prisma: `prisma.paymentRequest`, `Order.userId: string | null`, `Order.paymentRequestId: string | null`

- [ ] **Step 1: 스키마 수정**

`prisma/schema.prisma`에서 `enum OrderStatus { ... }` 블록 바로 아래에 추가:

```prisma
/// 단건 결제 요청 상태 — 만료(EXPIRED)는 유효기간 경과, 환불(REFUNDED)은 결제 후 취소
enum PaymentRequestStatus {
  PENDING
  PAID
  CANCELED
  EXPIRED
  REFUNDED
}

/// 단건 결제 요청 — 관리자가 비회원에게 문자로 결제 링크(/pay/{token})를 보낸다. 결제는 Order로 처리
model PaymentRequest {
  id                String               @id @default(cuid())
  /// 결제 링크 토큰 (randomBytes(32) base64url, 추측 불가)
  token             String               @unique
  title             String
  amount            Int
  /// 고객에게 표시되는 메모
  memo              String?
  recipientName     String
  /// 숫자만 (01012345678)
  recipientPhone    String
  /// 결제 시 고객이 입력한 이메일 (이니시스 V2 필수)
  customerEmail     String?
  status            PaymentRequestStatus @default(PENDING)
  expiresAt         DateTime
  /// 요청한 관리자 (아이디 변경과 무관하게 당시 값 보관)
  createdById       String
  createdByUsername String
  notifiedAt        DateTime?
  sentCount         Int                  @default(0)
  paidAt            DateTime?
  canceledAt        DateTime?
  createdAt         DateTime             @default(now())
  updatedAt         DateTime             @updatedAt
  orders            Order[]

  @@index([status, createdAt])
  @@index([recipientPhone])
}
```

`model Order`를 아래로 교체 (userId nullable, paymentRequest 추가):

```prisma
model Order {
  id               String          @id @default(cuid())
  /// 회원 주문이면 회원 ID, 비회원 단건 결제 요청이면 null
  userId           String?
  productId        String?
  invoiceId        String?
  /// 비회원 단건 결제 요청 주문
  paymentRequestId String?
  orderId          String          @unique
  amount           Int
  status           OrderStatus     @default(PENDING)
  paymentKey       String?
  method           String?
  failReason       String?
  paidAt           DateTime?
  createdAt        DateTime        @default(now())
  user             User?           @relation(fields: [userId], references: [id])
  product          Product?        @relation(fields: [productId], references: [id])
  invoice          Invoice?        @relation(fields: [invoiceId], references: [id])
  paymentRequest   PaymentRequest? @relation(fields: [paymentRequestId], references: [id])

  @@index([status, createdAt])
}
```

- [ ] **Step 2: Prisma 반영**

Run: `npx prisma generate; npx prisma db push --skip-generate`
Expected: `Your database is now in sync with your Prisma schema.` (데이터 손실 경고 없음)

- [ ] **Step 3: 실패하는 테스트 작성** — `lib/payment-request.test.ts`

```ts
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  PAYMENT_REQUEST_TOKEN_RE,
  generatePaymentRequestToken,
  isValidPaymentRequestToken,
  maskName,
  paymentRequestCreateSchema,
  paymentRequestExpiresAt,
  paymentRequestSmsText,
  paymentRequestView,
} from "./payment-request";

describe("generatePaymentRequestToken", () => {
  test("43자 base64url 형식이고 매번 다르다", () => {
    const a = generatePaymentRequestToken();
    const b = generatePaymentRequestToken();
    assert.match(a, PAYMENT_REQUEST_TOKEN_RE);
    assert.notEqual(a, b);
  });

  test("isValidPaymentRequestToken은 형식만 통과시킨다", () => {
    assert.equal(isValidPaymentRequestToken(generatePaymentRequestToken()), true);
    assert.equal(isValidPaymentRequestToken("short"), false);
    assert.equal(isValidPaymentRequestToken(`${"a".repeat(42)}/`), false);
  });
});

describe("maskName", () => {
  test("3자 이상은 가운데를 가린다", () => {
    assert.equal(maskName("홍길동"), "홍*동");
    assert.equal(maskName("남궁민수"), "남**수");
  });

  test("2자는 뒤를, 1자는 그대로", () => {
    assert.equal(maskName("김철"), "김*");
    assert.equal(maskName("김"), "김");
  });
});

describe("paymentRequestSmsText", () => {
  test("이름·항목·금액(천 단위 구분)·링크를 담는다", () => {
    const text = paymentRequestSmsText({
      recipientName: "홍길동",
      title: "엑셀 자동화 구축비",
      amount: 1500000,
      url: "https://optix.goodautosys.kr/pay/abc",
    });
    assert.equal(
      text,
      "[Optix] 홍길동님 결제 요청: 엑셀 자동화 구축비 1,500,000원\nhttps://optix.goodautosys.kr/pay/abc"
    );
  });
});

describe("paymentRequestCreateSchema", () => {
  const valid = {
    recipientName: " 홍길동 ",
    recipientPhone: "010-1234-5678",
    title: "구축비",
    amount: "150000",
    memo: "",
    validDays: undefined,
  };

  test("정규화하고 유효기간 기본 7일, 빈 메모는 null", () => {
    assert.deepEqual(paymentRequestCreateSchema.parse(valid), {
      recipientName: "홍길동",
      recipientPhone: "01012345678",
      title: "구축비",
      amount: 150000,
      memo: null,
      validDays: 7,
    });
  });

  test("금액 100원 미만·1억 초과·소수는 거부", () => {
    for (const amount of ["99", "100000001", "1000.5"]) {
      assert.equal(paymentRequestCreateSchema.safeParse({ ...valid, amount }).success, false, amount);
    }
  });

  test("유효기간 1~30일만 허용", () => {
    assert.equal(paymentRequestCreateSchema.safeParse({ ...valid, validDays: "0" }).success, false);
    assert.equal(paymentRequestCreateSchema.safeParse({ ...valid, validDays: "31" }).success, false);
    assert.equal(paymentRequestCreateSchema.parse({ ...valid, validDays: "30" }).validDays, 30);
  });

  test("휴대폰 형식 오류는 거부", () => {
    assert.equal(paymentRequestCreateSchema.safeParse({ ...valid, recipientPhone: "02-123-4567" }).success, false);
  });
});

describe("paymentRequestView / paymentRequestExpiresAt", () => {
  const now = new Date("2026-09-15T00:00:00Z");

  test("PENDING은 유효기간 전이면 payable, 지나면(경계 포함) expired", () => {
    assert.equal(paymentRequestView({ status: "PENDING", expiresAt: new Date("2026-09-15T00:00:01Z") }, now), "payable");
    assert.equal(paymentRequestView({ status: "PENDING", expiresAt: now }, now), "expired");
  });

  test("나머지 상태는 그대로 대응", () => {
    const expiresAt = new Date("2026-12-31T00:00:00Z");
    assert.equal(paymentRequestView({ status: "PAID", expiresAt }, now), "paid");
    assert.equal(paymentRequestView({ status: "CANCELED", expiresAt }, now), "canceled");
    assert.equal(paymentRequestView({ status: "EXPIRED", expiresAt }, now), "expired");
    assert.equal(paymentRequestView({ status: "REFUNDED", expiresAt }, now), "refunded");
  });

  test("유효기간은 now + N일", () => {
    assert.equal(paymentRequestExpiresAt(7, now).toISOString(), "2026-09-22T00:00:00.000Z");
  });
});
```

- [ ] **Step 4: 테스트가 실패하는지 확인**

Run: `npx tsx --test lib/payment-request.test.ts`
Expected: FAIL — `Cannot find module './payment-request'`

- [ ] **Step 5: 구현** — `lib/payment-request.ts`

```ts
import { randomBytes } from "node:crypto";
import { z } from "zod";
import type { PaymentRequestStatus } from "@prisma/client";
import { phoneSchema } from "@/lib/validators";

/**
 * 비회원 단건 결제 요청 공통 로직 (서버 전용 — node:crypto 사용, 클라이언트 컴포넌트에서 import 금지)
 */

export const PAYMENT_REQUEST_DEFAULT_DAYS = 7;
export const PAYMENT_REQUEST_MAX_DAYS = 30;
export const PAYMENT_REQUEST_TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

/** 결제 링크 토큰 — 256비트 난수 */
export function generatePaymentRequestToken(): string {
  return randomBytes(32).toString("base64url");
}

export function isValidPaymentRequestToken(token: string): boolean {
  return PAYMENT_REQUEST_TOKEN_RE.test(token);
}

/** 결제 페이지 표시용 이름 가림: 홍길동 → 홍*동, 김철 → 김* */
export function maskName(name: string): string {
  const chars = [...name.trim()];
  if (chars.length <= 1) return chars.join("");
  if (chars.length === 2) return `${chars[0]}*`;
  return `${chars[0]}${"*".repeat(chars.length - 2)}${chars[chars.length - 1]}`;
}

export function paymentRequestSmsText(input: {
  recipientName: string;
  title: string;
  amount: number;
  url: string;
}): string {
  return `[Optix] ${input.recipientName}님 결제 요청: ${input.title} ${input.amount.toLocaleString("ko-KR")}원\n${input.url}`;
}

export const paymentRequestCreateSchema = z.object({
  recipientName: z
    .string()
    .trim()
    .min(2, "받는 분 이름은 2자 이상 입력하세요.")
    .max(40, "받는 분 이름은 40자 이내로 입력하세요."),
  recipientPhone: phoneSchema,
  title: z.string().trim().min(1, "항목명을 입력하세요.").max(60, "항목명은 60자 이내로 입력하세요."),
  amount: z.coerce
    .number()
    .int("금액은 원 단위 정수로 입력하세요.")
    .min(100, "금액은 100원 이상이어야 합니다.")
    .max(100_000_000, "금액은 1억 원 이하여야 합니다."),
  memo: z
    .string()
    .trim()
    .max(200, "메모는 200자 이내로 입력하세요.")
    .optional()
    .transform((v) => (v ? v : null)),
  validDays: z.coerce
    .number()
    .int("유효기간은 1~30일입니다.")
    .min(1, "유효기간은 1~30일입니다.")
    .max(PAYMENT_REQUEST_MAX_DAYS, "유효기간은 1~30일입니다.")
    .default(PAYMENT_REQUEST_DEFAULT_DAYS),
});

export function paymentRequestExpiresAt(validDays: number, now: Date = new Date()): Date {
  return new Date(now.getTime() + validDays * DAY_MS);
}

export type PaymentRequestView = "payable" | "paid" | "canceled" | "expired" | "refunded";

/** 화면에 보여줄 상태. PENDING이라도 유효기간이 지났으면 만료로 본다 (정기 작업 반영 전) */
export function paymentRequestView(
  request: { status: PaymentRequestStatus; expiresAt: Date },
  now: Date = new Date()
): PaymentRequestView {
  switch (request.status) {
    case "PAID":
      return "paid";
    case "CANCELED":
      return "canceled";
    case "REFUNDED":
      return "refunded";
    case "EXPIRED":
      return "expired";
    default:
      return request.expiresAt.getTime() > now.getTime() ? "payable" : "expired";
  }
}

/** 결제할 수 없는 상태의 고객 안내 문구 (결제 페이지·주문 API 공용) */
export const PAYMENT_REQUEST_VIEW_MESSAGE: Record<Exclude<PaymentRequestView, "payable">, string> = {
  paid: "이미 결제가 완료된 요청입니다. 카드 매출전표는 결제 시 입력한 이메일로 발송됩니다.",
  canceled: "취소된 결제 요청입니다. 필요하면 담당자에게 문의해 주세요.",
  expired: "유효기간이 지난 결제 요청입니다. 담당자에게 새 결제 링크를 요청해 주세요.",
  refunded: "환불 처리된 결제 요청입니다.",
};

export const PAYMENT_REQUEST_STATUS_LABEL: Record<PaymentRequestView, { label: string; className: string }> = {
  payable: { label: "결제 대기", className: "bg-yellow-500/15 text-yellow-400" },
  paid: { label: "결제 완료", className: "bg-accent/15 text-accent" },
  canceled: { label: "취소", className: "bg-muted/15 text-muted" },
  expired: { label: "만료", className: "bg-muted/15 text-muted" },
  refunded: { label: "환불", className: "bg-red-500/15 text-red-400" },
};
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `npx tsx --test lib/payment-request.test.ts`
Expected: PASS (모든 테스트 ok)

- [ ] **Step 7: test 스크립트에 추가**

`package.json`의 `"test"` 값 끝에 ` lib/payment-request.test.ts`를 붙인다. Run: `npm test` → Expected: fail 0

- [ ] **Step 8: Commit**

```
git add prisma/schema.prisma lib/payment-request.ts lib/payment-request.test.ts package.json
git commit -F <메시지파일>   # feat: 단건 결제 요청 스키마와 공통 로직
```

(이 시점의 `npx tsc --noEmit`은 `order.user` nullable 때문에 실패할 수 있다. Task 2에서 해결한다.)

---

### Task 2: 결제 동기화·환불·만료·주문 표시를 비회원 주문에 맞추기

**Files:**
- Modify: `lib/payment-sync.ts`
- Modify: `app/optix-dev/actions.ts` (`cancelOrder`)
- Modify: `lib/order-expiry.ts`, `lib/maintenance.ts`
- Create: `lib/order-id.ts`; Modify: `app/api/orders/route.ts`
- Modify: `app/optix-dev/orders/page.tsx`, `app/optix-dev/page.tsx`

**Interfaces:**
- Consumes: Task 1의 Prisma 모델
- Produces:
  - `expireStalePaymentRequests(now?: Date): Promise<number>` (`lib/order-expiry.ts`)
  - `newOrderId(): string` (`lib/order-id.ts`)
  - payment-sync: 결제 요청 주문 PAID 시 요청 PAID, 이미 PAID/CANCELED/REFUNDED인 요청이면 자동 환불, 포트원 취소 시 요청 REFUNDED

- [ ] **Step 1: `lib/order-id.ts` 생성**

```ts
import { randomBytes } from "node:crypto";

/** 추측 불가능한 주문번호 (포트원 paymentId로도 사용) */
export function newOrderId(): string {
  return `GAS-${Date.now()}-${randomBytes(6).toString("hex")}`;
}
```

`app/api/orders/route.ts`에서 `import { randomBytes } from "node:crypto";` 줄과 로컬 `newOrderId` 함수(주석 포함 4줄)를 지우고 `import { newOrderId } from "@/lib/order-id";`를 추가한다.

- [ ] **Step 2: `lib/payment-sync.ts` 수정**

(a) 중복 메시지 일반화 — 교체:
```ts
const DUPLICATE_MESSAGE =
  "이미 결제가 완료되었거나 취소된 요청이라 이번 결제는 자동으로 환불 처리되었습니다.";
```

(b) `DuplicatePaymentError`의 kind에 `"payment_request"` 추가:
```ts
class DuplicatePaymentError extends Error {
  constructor(public readonly kind: "invoice" | "one_time" | "payment_request") {
    super(`중복 결제: ${kind}`);
  }
}
```
`refundDuplicate`의 `kind` 파라미터 타입도 `"invoice" | "one_time" | "payment_request"`로 바꾼다.

(c) `handlePaid` 트랜잭션 안의 1회 상품 중복 검사 조건을 회원 주문으로 한정:
```ts
      if (order.product?.billingType === "ONE_TIME" && order.productId && order.userId) {
```

(d) 같은 트랜잭션에서 청구서 블록(`if (order.invoiceId) { ... }`) 바로 뒤, `return true;` 앞에 추가:
```ts
      // 비회원 단건 결제 요청은 대기·만료 상태일 때만 결제 완료 처리 (이미 결제·취소·환불된 요청이면 중복)
      if (order.paymentRequestId) {
        const request = await tx.paymentRequest.updateMany({
          where: { id: order.paymentRequestId, status: { in: ["PENDING", "EXPIRED"] } },
          data: { status: "PAID", paidAt },
        });
        if (request.count !== 1) throw new DuplicatePaymentError("payment_request");
      }
```

(e) 월 결제 설정 호출을 회원 주문으로 한정 — 교체:
```ts
  if (order.product?.billingType === "MONTHLY" && order.userId) {
    try {
      await setupMonthlyBillingAfterPurchase({
        orderId,
        userId: order.userId,
        product: { name: order.product.name, price: order.product.price },
        paidAt,
      });
```
(나머지 catch 블록은 그대로)

(f) `handleCancelled` 트랜잭션의 청구서 블록 뒤, `return true;` 앞에 추가:
```ts
      if (order.paymentRequestId) {
        await tx.paymentRequest.updateMany({
          where: { id: order.paymentRequestId, status: "PAID" },
          data: { status: "REFUNDED", canceledAt: new Date() },
        });
      }
```

- [ ] **Step 3: 관리자 결제취소에서 요청 환불 처리** — `app/optix-dev/actions.ts`의 `cancelOrder` `$transaction` 배열, 청구서 spread 뒤에 추가:
```ts
    // 비회원 단건 결제 요청을 환불하면 요청 상태도 환불로
    ...(order.paymentRequestId
      ? [
          prisma.paymentRequest.update({
            where: { id: order.paymentRequestId },
            data: { status: "REFUNDED", canceledAt: new Date() },
          }),
        ]
      : []),
```
그리고 `revalidatePath("/mypage");` 아래에 `revalidatePath("/optix-dev/payment-requests");` 추가.

- [ ] **Step 4: 결제 요청 만료** — `lib/order-expiry.ts` 끝에 추가:
```ts
/** 유효기간이 지난 결제 대기 요청을 EXPIRED로 정리한다 (결제창이 열린 채 늦게 결제되면 payment-sync가 PAID로 인정) */
export async function expireStalePaymentRequests(now: Date = new Date()): Promise<number> {
  const result = await prisma.paymentRequest.updateMany({
    where: { status: "PENDING", expiresAt: { lte: now } },
    data: { status: "EXPIRED" },
  });
  return result.count;
}
```

`lib/maintenance.ts`: 기존 `import { expireStalePendingOrders } from "@/lib/order-expiry";` 줄을 아래로 바꾸고
```ts
import { expireStalePaymentRequests, expireStalePendingOrders } from "@/lib/order-expiry";
```
`runOrderExpiry` 본문을 교체:
```ts
async function runOrderExpiry() {
  try {
    const expired = await expireStalePendingOrders();
    if (expired > 0) console.info(`[maintenance] 결제 대기 주문 ${expired}건 만료`);
    const expiredRequests = await expireStalePaymentRequests();
    if (expiredRequests > 0) console.info(`[maintenance] 단건 결제 요청 ${expiredRequests}건 만료`);
  } catch (e) {
    console.error("[maintenance] 주문 만료 처리 실패", e);
  }
}
```

- [ ] **Step 5: 관리자 주문내역 표시** — `app/optix-dev/orders/page.tsx`

검색 `OR` 배열 끝에 추가:
```ts
              { paymentRequest: { recipientName: { contains: q } } },
              { paymentRequest: { title: { contains: q } } },
```
`include: { user: true, product: true, invoice: true }` → `include: { user: true, product: true, invoice: true, paymentRequest: true }`

placeholder `"주문번호/회원/상품 검색"` → `"주문번호/회원/상품/받는 분 검색"`

회원 칸 교체:
```tsx
                    <td className="whitespace-nowrap p-4">
                      {order.user ? (
                        <>
                          {order.user.name}
                          <span className="block text-xs text-muted">{order.user.username}</span>
                        </>
                      ) : (
                        <>
                          <span className="text-muted">비회원</span>
                          <span className="block text-xs">{order.paymentRequest?.recipientName ?? "—"}</span>
                        </>
                      )}
                    </td>
```
상품 칸의 `) : (\n "—"` 앞에 결제 요청 분기 추가 — 상품 칸 전체 교체:
```tsx
                    <td className="p-4">
                      {order.product ? (
                        order.product.name
                      ) : order.invoice ? (
                        <>
                          <span className="mr-2 rounded-full bg-accent-2/15 px-2 py-0.5 text-[10px] text-accent-2">
                            월결제
                          </span>
                          {invoiceOrderName(order.invoice.title, order.invoice.billingMonth)}
                        </>
                      ) : order.paymentRequest ? (
                        <>
                          <span className="mr-2 rounded-full bg-yellow-500/15 px-2 py-0.5 text-[10px] text-yellow-400">
                            단건
                          </span>
                          {order.paymentRequest.title}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
```

- [ ] **Step 6: 대시보드 최근 주문** — `app/optix-dev/page.tsx`

최근 주문 조회의 `include: { user: true, product: true, invoice: true }` → `include: { user: true, product: true, invoice: true, paymentRequest: true }`

상품명 표현식 교체:
```tsx
                        {order.product
                          ? order.product.name
                          : order.invoice
                            ? `[월결제] ${invoiceOrderName(order.invoice.title, order.invoice.billingMonth)}`
                            : order.paymentRequest
                              ? `[단건] ${order.paymentRequest.title}`
                              : "—"}
```
`{order.user.name} ·{" "}` → `{order.user?.name ?? `비회원 ${order.paymentRequest?.recipientName ?? ""}`} ·{" "}`

- [ ] **Step 7: 검증**

Run: `npx tsc --noEmit` → Expected: 출력 없음 (exit 0). 오류가 남으면 `order.user`/`order.userId` null 사용처를 같은 방식으로 처리.
Run: `npm test` → Expected: fail 0

- [ ] **Step 8: Commit** — `feat: 결제 동기화·환불·만료를 비회원 결제 요청 주문에 확장`

---

### Task 3: 관리자 "단건 결제" 메뉴

**Files:**
- Modify: `lib/audit.ts`
- Create: `app/optix-dev/payment-requests/actions.ts`
- Create: `app/optix-dev/payment-requests/page.tsx`
- Create: `components/admin-payment-request-form.tsx`
- Create: `components/admin-payment-request-actions.tsx`
- Modify: `components/admin-nav.tsx`

**Interfaces:**
- Consumes: Task 1 `paymentRequestCreateSchema`, `generatePaymentRequestToken`, `paymentRequestExpiresAt`, `paymentRequestSmsText`, `paymentRequestView`, `PAYMENT_REQUEST_STATUS_LABEL`, `PAYMENT_REQUEST_DEFAULT_DAYS`, `PAYMENT_REQUEST_MAX_DAYS`; `requireAdmin`, `requireAdminPage`, `assertId`; `writeAudit`, `logAdminView`; `getSmsConfig`, `sendSms`; `siteUrl`; `checkRateLimit`
- Produces:
  - `interface PaymentRequestActionState { error?: string; ok?: boolean; message?: string }`
  - `createPaymentRequest(prev: PaymentRequestActionState, formData: FormData): Promise<PaymentRequestActionState>` — form fields `recipientName, recipientPhone, title, amount, memo, validDays, notify("on")`
  - `resendPaymentRequest(prev, formData)` — field `id`
  - `cancelPaymentRequest(id: string): Promise<void>`
  - 감사 이벤트 `ADMIN_VIEW_PAYMENT_REQUESTS`, `ADMIN_PAYMENT_REQUEST_CREATED`, `ADMIN_PAYMENT_REQUEST_SENT`, `ADMIN_PAYMENT_REQUEST_CANCELED`

- [ ] **Step 1: 감사 이벤트 추가** — `lib/audit.ts`의 `AUDIT_ACTIONS`에서 `ADMIN_VIEW_AUDIT` 줄 아래:
```ts
  ADMIN_VIEW_PAYMENT_REQUESTS: "단건 결제 목록 열람",
```
`ADMIN_INQUIRY_DELETED` 줄 아래:
```ts
  ADMIN_PAYMENT_REQUEST_CREATED: "단건 결제 요청 생성",
  ADMIN_PAYMENT_REQUEST_SENT: "단건 결제 문자 발송",
  ADMIN_PAYMENT_REQUEST_CANCELED: "단건 결제 요청 취소",
```

- [ ] **Step 2: 서버 액션** — `app/optix-dev/payment-requests/actions.ts`

```ts
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertId, requireAdmin } from "@/lib/auth-guard";
import { writeAudit } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rate-limit";
import { getSmsConfig, sendSms } from "@/lib/sms";
import { siteUrl } from "@/lib/site-url";
import {
  generatePaymentRequestToken,
  paymentRequestCreateSchema,
  paymentRequestExpiresAt,
  paymentRequestSmsText,
  paymentRequestView,
} from "@/lib/payment-request";

export interface PaymentRequestActionState {
  error?: string;
  ok?: boolean;
  message?: string;
}

/** 같은 요청의 문자는 10분에 1건 (문자 비용·수신자 불편 방지) */
const SMS_INTERVAL_MS = 10 * 60 * 1000;

function smsAllowed(requestId: string) {
  return checkRateLimit(`payment-request-sms:${requestId}`, 1, SMS_INTERVAL_MS).ok;
}

/** 결제 요청 문자 발송. SOLAPI 미설정(로컬)이면 콘솔 출력 후 "dev" */
async function sendRequestSms(request: {
  id: string;
  token: string;
  title: string;
  amount: number;
  recipientName: string;
  recipientPhone: string;
}): Promise<"sent" | "dev"> {
  const text = paymentRequestSmsText({
    recipientName: request.recipientName,
    title: request.title,
    amount: request.amount,
    url: `${siteUrl()}/pay/${request.token}`,
  });
  const config = getSmsConfig();
  if (!config) {
    console.log(`[sms] SOLAPI 미설정 — 개발 모드. ${request.recipientPhone} 단건 결제 요청: ${text}`);
    return "dev";
  }
  await sendSms(request.recipientPhone, text, config);
  await prisma.paymentRequest.update({
    where: { id: request.id },
    data: { notifiedAt: new Date(), sentCount: { increment: 1 } },
  });
  return "sent";
}

function smsErrorMessage(e: unknown) {
  return `문자 발송 실패: ${e instanceof Error ? e.message : "알 수 없는 오류"}`;
}

export async function createPaymentRequest(
  _prev: PaymentRequestActionState,
  formData: FormData
): Promise<PaymentRequestActionState> {
  const session = await requireAdmin();

  const parsed = paymentRequestCreateSchema.safeParse({
    recipientName: String(formData.get("recipientName") ?? ""),
    recipientPhone: String(formData.get("recipientPhone") ?? ""),
    title: String(formData.get("title") ?? ""),
    amount: String(formData.get("amount") ?? ""),
    memo: String(formData.get("memo") ?? "") || undefined,
    validDays: String(formData.get("validDays") ?? "") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값이 올바르지 않습니다." };
  }
  const { recipientName, recipientPhone, title, amount, memo, validDays } = parsed.data;
  const notify = formData.get("notify") === "on";

  const request = await prisma.paymentRequest.create({
    data: {
      token: generatePaymentRequestToken(),
      title,
      amount,
      memo,
      recipientName,
      recipientPhone,
      expiresAt: paymentRequestExpiresAt(validDays),
      createdById: session.user.id,
      createdByUsername: session.user.username,
    },
  });

  let message = `${recipientName}님 결제 요청(${amount.toLocaleString()}원)을 만들었습니다.`;
  let sms: "sent" | "dev" | "failed" | "skipped" = "skipped";
  if (notify) {
    smsAllowed(request.id);
    try {
      sms = await sendRequestSms(request);
      message += sms === "sent" ? " 문자를 보냈습니다." : " (문자 미설정: 발송 생략)";
    } catch (e) {
      sms = "failed";
      message += ` ${smsErrorMessage(e)}`;
    }
  }

  await writeAudit({
    actor: session.user,
    action: "ADMIN_PAYMENT_REQUEST_CREATED",
    targetType: "paymentRequest",
    targetId: request.id,
    detail: { title, amount, validDays, sms },
  });
  revalidatePath("/optix-dev/payment-requests");
  return { ok: true, message };
}

export async function resendPaymentRequest(
  _prev: PaymentRequestActionState,
  formData: FormData
): Promise<PaymentRequestActionState> {
  const session = await requireAdmin();
  const id = assertId(formData.get("id"), "paymentRequestId");

  const request = await prisma.paymentRequest.findUnique({ where: { id } });
  if (!request) return { error: "결제 요청을 찾을 수 없습니다." };
  if (paymentRequestView(request) !== "payable") {
    return { error: "결제 대기 중이고 유효기간이 남은 요청만 문자를 보낼 수 있습니다." };
  }
  if (!smsAllowed(id)) return { error: "같은 요청은 10분에 한 번만 문자를 보낼 수 있습니다." };

  try {
    const result = await sendRequestSms(request);
    await writeAudit({
      actor: session.user,
      action: "ADMIN_PAYMENT_REQUEST_SENT",
      targetType: "paymentRequest",
      targetId: id,
      detail: { result },
    });
    revalidatePath("/optix-dev/payment-requests");
    return result === "sent"
      ? { ok: true, message: "문자를 보냈습니다." }
      : { ok: true, message: "문자(SOLAPI)가 설정되지 않아 서버 콘솔에만 출력했습니다." };
  } catch (e) {
    return { error: smsErrorMessage(e) };
  }
}

/** 결제 대기·만료 요청 취소. 취소 뒤 결제가 들어오면 payment-sync가 자동 환불한다 */
export async function cancelPaymentRequest(id: string) {
  const session = await requireAdmin();
  assertId(id, "paymentRequestId");

  const result = await prisma.paymentRequest.updateMany({
    where: { id, status: { in: ["PENDING", "EXPIRED"] } },
    data: { status: "CANCELED", canceledAt: new Date() },
  });
  if (result.count !== 1) throw new Error("결제 대기·만료 상태의 요청만 취소할 수 있습니다.");

  await writeAudit({
    actor: session.user,
    action: "ADMIN_PAYMENT_REQUEST_CANCELED",
    targetType: "paymentRequest",
    targetId: id,
  });
  revalidatePath("/optix-dev/payment-requests");
}
```

- [ ] **Step 3: 생성 폼** — `components/admin-payment-request-form.tsx`

```tsx
"use client";

import { useActionState } from "react";
import {
  createPaymentRequest,
  type PaymentRequestActionState,
} from "@/app/optix-dev/payment-requests/actions";

const inputClass =
  "w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none";

/** 비회원 단건 결제 요청 생성 폼 (유효기간 기본값·최대값은 서버 페이지에서 전달) */
export default function AdminPaymentRequestForm({
  defaultDays,
  maxDays,
}: {
  defaultDays: number;
  maxDays: number;
}) {
  const [state, action, pending] = useActionState<PaymentRequestActionState, FormData>(
    createPaymentRequest,
    {}
  );

  return (
    <form action={action} className="grid gap-3 md:grid-cols-2">
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-muted">받는 분 이름</span>
        <input name="recipientName" required minLength={2} maxLength={40} placeholder="홍길동" className={inputClass} />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-muted">휴대폰 번호</span>
        <input
          name="recipientPhone"
          type="tel"
          inputMode="tel"
          required
          placeholder="010-0000-0000"
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-muted">항목명</span>
        <input name="title" required maxLength={60} placeholder="예: 엑셀 자동화 구축비" className={inputClass} />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-muted">금액 (원, 부가세 포함)</span>
        <input
          name="amount"
          type="number"
          required
          min={100}
          max={100000000}
          step={1}
          placeholder="1500000"
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm md:col-span-2">
        <span className="text-muted">메모 (선택, 고객 결제 화면에 표시)</span>
        <input name="memo" maxLength={200} placeholder="예: 9월 작업분 · 견적서 기준" className={inputClass} />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-muted">유효기간 (일, 최대 {maxDays}일)</span>
        <input
          name="validDays"
          type="number"
          min={1}
          max={maxDays}
          defaultValue={defaultDays}
          className={inputClass}
        />
      </label>
      <label className="flex items-center gap-2 self-end pb-2 text-sm text-muted">
        <input type="checkbox" name="notify" defaultChecked className="h-4 w-4 accent-accent" />
        받는 분에게 결제 링크 문자 발송
      </label>
      <div className="flex flex-wrap items-center gap-3 md:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-accent/80 disabled:opacity-50"
        >
          {pending ? "처리 중..." : "결제 요청 만들기"}
        </button>
        {state.error && <p className="text-sm text-red-400">{state.error}</p>}
        {state.message && !state.error && <p className="text-sm text-accent">{state.message}</p>}
      </div>
    </form>
  );
}
```

- [ ] **Step 4: 행 버튼** — `components/admin-payment-request-actions.tsx`

```tsx
"use client";

import { useActionState, useState } from "react";
import {
  resendPaymentRequest,
  type PaymentRequestActionState,
} from "@/app/optix-dev/payment-requests/actions";

/** 결제 링크 복사 (카카오톡 등으로 직접 전달할 때) */
export function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          window.prompt("결제 링크를 복사하세요", url);
        }
      }}
      className="whitespace-nowrap rounded-lg border border-line px-3 py-1.5 text-xs text-muted transition hover:text-foreground"
    >
      {copied ? "복사됨" : "링크 복사"}
    </button>
  );
}

export function ResendButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState<PaymentRequestActionState, FormData>(
    resendPaymentRequest,
    {}
  );
  return (
    <form action={action} className="flex flex-col items-start gap-1">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        className="whitespace-nowrap rounded-lg border border-accent/40 px-3 py-1.5 text-xs text-accent transition hover:bg-accent/10 disabled:opacity-50"
      >
        {pending ? "발송 중..." : "문자 재발송"}
      </button>
      {state.error && <p className="max-w-48 text-xs text-red-400">{state.error}</p>}
      {state.message && !state.error && <p className="text-xs text-accent">{state.message}</p>}
    </form>
  );
}
```

- [ ] **Step 5: 관리자 페이지** — `app/optix-dev/payment-requests/page.tsx`

```tsx
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/auth-guard";
import { logAdminView } from "@/lib/audit";
import { formatPhone } from "@/lib/phone";
import { siteUrl } from "@/lib/site-url";
import {
  PAYMENT_REQUEST_DEFAULT_DAYS,
  PAYMENT_REQUEST_MAX_DAYS,
  PAYMENT_REQUEST_STATUS_LABEL,
  paymentRequestView,
} from "@/lib/payment-request";
import AdminPaymentRequestForm from "@/components/admin-payment-request-form";
import { CopyLinkButton, ResendButton } from "@/components/admin-payment-request-actions";
import { cancelPaymentRequest } from "./actions";

export const metadata = { title: "단건 결제" };

const STATUS_FILTER = ["PENDING", "PAID", "CANCELED", "EXPIRED", "REFUNDED"] as const;
type StatusFilter = (typeof STATUS_FILTER)[number];
const STATUS_FILTER_LABEL: Record<StatusFilter, string> = {
  PENDING: "결제 대기",
  PAID: "결제 완료",
  CANCELED: "취소",
  EXPIRED: "만료",
  REFUNDED: "환불",
};

const filterClass =
  "rounded-lg border border-line bg-surface-2 px-3 py-2 text-foreground placeholder:text-muted focus:border-accent focus:outline-none";

export default async function AdminPaymentRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const session = await requireAdminPage();
  const { q, status } = await searchParams;
  await logAdminView(session, "ADMIN_VIEW_PAYMENT_REQUESTS", { q, status });

  const statusFilter = STATUS_FILTER.find((s) => s === status);
  const phoneQuery = q?.replace(/\D/g, "");
  const requests = await prisma.paymentRequest.findMany({
    where: {
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(q
        ? {
            OR: [
              { recipientName: { contains: q } },
              { title: { contains: q } },
              ...(phoneQuery ? [{ recipientPhone: { contains: phoneQuery } }] : []),
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const now = new Date();
  const base = siteUrl();

  return (
    <div>
      <h1 className="text-2xl font-bold">단건 결제</h1>
      <p className="mt-2 text-sm text-muted">
        회원가입하지 않은 고객에게 항목·금액을 정해 결제 링크를 문자로 보냅니다. 고객은 로그인 없이 카드로
        결제하며, 결제 내역은{" "}
        <Link href="/optix-dev/orders" className="text-accent hover:underline">
          주문내역
        </Link>
        에서 확인·환불합니다.
      </p>

      <section className="mt-6 rounded-2xl border border-line bg-surface p-6">
        <h2 className="font-bold">결제 요청 만들기</h2>
        <div className="mt-4">
          <AdminPaymentRequestForm
            defaultDays={PAYMENT_REQUEST_DEFAULT_DAYS}
            maxDays={PAYMENT_REQUEST_MAX_DAYS}
          />
        </div>
      </section>

      <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl font-bold">요청 목록</h2>
        <form className="flex w-full flex-wrap gap-2 text-sm sm:w-auto">
          <select name="status" defaultValue={statusFilter ?? ""} className={filterClass}>
            <option value="">전체 상태</option>
            {STATUS_FILTER.map((s) => (
              <option key={s} value={s}>
                {STATUS_FILTER_LABEL[s]}
              </option>
            ))}
          </select>
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="받는 분/휴대폰/항목 검색"
            className={`${filterClass} min-w-0 flex-1 sm:w-52 sm:flex-none`}
          />
          <button
            type="submit"
            className="rounded-lg bg-accent px-4 py-2 font-medium text-white transition hover:bg-accent/80"
          >
            검색
          </button>
        </form>
      </div>

      <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs text-muted">
              <th className="whitespace-nowrap p-4 font-normal">요청일</th>
              <th className="whitespace-nowrap p-4 font-normal">받는 분</th>
              <th className="whitespace-nowrap p-4 font-normal">항목 · 금액</th>
              <th className="whitespace-nowrap p-4 font-normal">상태</th>
              <th className="whitespace-nowrap p-4 font-normal">문자</th>
              <th className="whitespace-nowrap p-4 font-normal">관리</th>
            </tr>
          </thead>
          <tbody>
            {requests.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted">
                  결제 요청이 없습니다.
                </td>
              </tr>
            ) : (
              requests.map((req) => {
                const view = paymentRequestView(req, now);
                const badge = PAYMENT_REQUEST_STATUS_LABEL[view];
                return (
                  <tr key={req.id} className="border-b border-line/50 align-top">
                    <td className="whitespace-nowrap p-4 text-xs text-muted">
                      {req.createdAt.toLocaleString("ko-KR")}
                      <span className="block">{req.createdByUsername}</span>
                    </td>
                    <td className="whitespace-nowrap p-4">
                      {req.recipientName}
                      <span className="block text-xs text-muted">{formatPhone(req.recipientPhone)}</span>
                    </td>
                    <td className="p-4">
                      <p>{req.title}</p>
                      <p className="font-medium">{req.amount.toLocaleString()}원</p>
                      {req.memo && <p className="text-xs text-muted">{req.memo}</p>}
                    </td>
                    <td className="whitespace-nowrap p-4">
                      <span className={`rounded-full px-2.5 py-1 text-xs ${badge.className}`}>{badge.label}</span>
                      <span className="mt-1 block text-xs text-muted">
                        {req.paidAt
                          ? `결제 ${req.paidAt.toLocaleString("ko-KR")}`
                          : `유효 ~ ${req.expiresAt.toLocaleDateString("ko-KR")}`}
                      </span>
                    </td>
                    <td className="whitespace-nowrap p-4 text-xs text-muted">
                      {req.notifiedAt ? `${req.sentCount}회 · ${req.notifiedAt.toLocaleString("ko-KR")}` : "미발송"}
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap items-start gap-1.5">
                        {view === "payable" && (
                          <>
                            <CopyLinkButton url={`${base}/pay/${req.token}`} />
                            <ResendButton id={req.id} />
                          </>
                        )}
                        {(req.status === "PENDING" || req.status === "EXPIRED") && (
                          <form
                            action={async () => {
                              "use server";
                              await cancelPaymentRequest(req.id);
                            }}
                          >
                            <button
                              type="submit"
                              className="whitespace-nowrap rounded-lg border border-red-500/40 px-3 py-1.5 text-xs text-red-400 transition hover:bg-red-500/10"
                            >
                              요청 취소
                            </button>
                          </form>
                        )}
                        {(req.status === "PAID" || req.status === "REFUNDED") && (
                          <Link
                            href={`/optix-dev/orders?q=${encodeURIComponent(req.recipientName)}`}
                            className="whitespace-nowrap text-xs text-muted hover:text-foreground"
                          >
                            주문 보기
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted">
        최근 200건까지 표시됩니다. 결제 완료 건의 환불은 주문내역의 결제취소에서 진행하며, 취소한 요청에 결제가
        들어오면 자동으로 환불됩니다.
      </p>
    </div>
  );
}
```

- [ ] **Step 6: 메뉴 추가** — `components/admin-nav.tsx`의 `MENU`에서 월결제 관리 줄 아래:
```ts
  { href: "/optix-dev/payment-requests", label: "단건 결제", icon: "✦" },
```

- [ ] **Step 7: 검증** — Run: `npx tsc --noEmit` → exit 0; `npx eslint app/optix-dev/payment-requests components/admin-payment-request-form.tsx components/admin-payment-request-actions.tsx` → 오류 없음

- [ ] **Step 8: Commit** — `feat: 관리자 단건 결제 요청 메뉴 (생성·문자 발송·취소)`

---

### Task 4: 고객 결제 페이지 + 비회원 주문 API

**Files:**
- Create: `app/api/pay/[token]/order/route.ts`
- Create: `app/pay/[token]/page.tsx`
- Create: `app/pay/[token]/complete/page.tsx`
- Create: `components/payment-request-checkout.tsx`
- Modify: `next.config.ts`, `app/robots.ts`, `app/privacy/page.tsx`

**Interfaces:**
- Consumes: Task 1 `isValidPaymentRequestToken`, `maskName`, `paymentRequestView`, `PAYMENT_REQUEST_VIEW_MESSAGE`; Task 2 `newOrderId`; `expireStalePendingOrders`; `syncPaymentFromPortOne`, `PaymentSyncResult`; `emailSchema`; `checkRateLimit`, `getClientIp`; `SITE_INFO`, `PRICE_NOTE`, `RECEIPT_NOTE`
- Produces:
  - `POST /api/pay/{token}/order` body `{ email: string; agree: boolean }` → 200 `{ orderId, amount, orderName, customerName, customerPhone, customerEmail }` / 400 / 404 / 409 / 429
  - `/pay/{token}`, `/pay/{token}/complete?paymentId=`

- [ ] **Step 1: 주문 API** — `app/api/pay/[token]/order/route.ts`

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { emailSchema } from "@/lib/validators";
import { expireStalePendingOrders } from "@/lib/order-expiry";
import { newOrderId } from "@/lib/order-id";
import {
  PAYMENT_REQUEST_VIEW_MESSAGE,
  isValidPaymentRequestToken,
  paymentRequestView,
} from "@/lib/payment-request";

const bodySchema = z.object({
  email: emailSchema,
  agree: z.boolean().refine((v) => v === true, "개인정보 수집·이용 및 제공에 동의해 주세요."),
});

const WINDOW_MS = 10 * 60 * 1000;
const IP_LIMIT = 20;
const TOKEN_LIMIT = 10;
const NOT_FOUND = { error: "결제 요청을 찾을 수 없습니다." };

function tooMany(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: "결제 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
  );
}

/** 비회원 단건 결제: 결제하기를 누르면 PENDING 주문 생성. 금액은 결제 요청(DB) 금액으로 확정한다 */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const ipLimit = checkRateLimit(`pay-order-ip:${getClientIp(request)}`, IP_LIMIT, WINDOW_MS);
  if (!ipLimit.ok) return tooMany(ipLimit.retryAfterSeconds);
  if (!isValidPaymentRequestToken(token)) return NextResponse.json(NOT_FOUND, { status: 404 });
  const tokenLimit = checkRateLimit(`pay-order-token:${token}`, TOKEN_LIMIT, WINDOW_MS);
  if (!tokenLimit.ok) return tooMany(tokenLimit.retryAfterSeconds);

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "입력값이 올바르지 않습니다." },
      { status: 400 }
    );
  }

  const paymentRequest = await prisma.paymentRequest.findUnique({ where: { token } });
  if (!paymentRequest) return NextResponse.json(NOT_FOUND, { status: 404 });

  const view = paymentRequestView(paymentRequest);
  if (view !== "payable") {
    return NextResponse.json({ error: PAYMENT_REQUEST_VIEW_MESSAGE[view] }, { status: 409 });
  }

  await expireStalePendingOrders().catch((e) => console.error("[pay] 만료 주문 정리 실패", e));

  const orderId = newOrderId();
  const email = parsed.data.email;
  await prisma.$transaction([
    prisma.order.create({
      data: {
        userId: null,
        paymentRequestId: paymentRequest.id,
        orderId,
        amount: paymentRequest.amount,
        status: "PENDING",
      },
    }),
    prisma.paymentRequest.update({
      where: { id: paymentRequest.id },
      data: { customerEmail: email },
    }),
  ]);

  return NextResponse.json({
    orderId,
    amount: paymentRequest.amount,
    orderName: paymentRequest.title,
    customerName: paymentRequest.recipientName,
    customerPhone: paymentRequest.recipientPhone,
    customerEmail: email,
  });
}
```

- [ ] **Step 2: 결제 컴포넌트** — `components/payment-request-checkout.tsx`

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PortOne from "@portone/browser-sdk/v2";

const inputClass =
  "w-full rounded-lg border border-line bg-surface-2 px-4 py-3 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none";

interface CreatedOrder {
  orderId: string;
  amount: number;
  orderName: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
}

/** 비회원 단건 결제: 이메일·동의 입력 → 주문 생성 → 포트원 카드 결제창 */
export default function PaymentRequestCheckout({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const agree = form.get("agree") === "on";
    if (!agree) {
      setError("개인정보 수집·이용 및 제공에 동의해 주세요.");
      return;
    }

    const storeId = process.env.NEXT_PUBLIC_PORTONE_STORE_ID;
    const channelKey = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY;
    if (!storeId || !channelKey) {
      setError("결제 설정이 완료되지 않았습니다. 담당자에게 문의해 주세요.");
      return;
    }

    setPaying(true);
    try {
      const res = await fetch(`/api/pay/${encodeURIComponent(token)}/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, agree }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "결제를 시작하지 못했습니다.");
      const order = data as CreatedOrder;

      const response = await PortOne.requestPayment({
        storeId,
        channelKey,
        paymentId: order.orderId,
        orderName: order.orderName,
        // 표시용 금액일 뿐, 실제 결제 금액은 서버가 포트원 조회로 요청 금액과 대조한다
        totalAmount: order.amount,
        currency: "KRW",
        payMethod: "CARD",
        customer: {
          fullName: order.customerName,
          phoneNumber: order.customerPhone,
          email: order.customerEmail,
        },
        redirectUrl: `${window.location.origin}/pay/${token}/complete`,
      });

      if (!response || response.code !== undefined) {
        setError(response?.message ?? "결제가 취소되었습니다.");
        setPaying(false);
        return;
      }
      router.push(`/pay/${token}/complete?paymentId=${encodeURIComponent(response.paymentId)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "결제 요청 중 오류가 발생했습니다.");
      setPaying(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-6">
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-muted">
          이메일 <span className="text-red-400">*</span>
          <span className="ml-1 text-xs">(카드 매출전표 발송 · 결제사 필수 항목)</span>
        </span>
        <input
          name="email"
          type="email"
          required
          maxLength={254}
          autoComplete="email"
          autoCapitalize="none"
          placeholder="name@example.com"
          className={inputClass}
        />
      </label>

      <label className="flex items-start gap-2.5 rounded-lg border border-line bg-surface-2/60 p-4 text-xs leading-relaxed text-muted">
        <input type="checkbox" name="agree" required className="mt-0.5 h-4 w-4 shrink-0 accent-accent" />
        <span>
          <span className="text-red-400">[필수]</span> 결제 처리를 위한 개인정보 수집·이용 및 제공에 동의합니다.
          <span className="mt-1 block">
            수집 항목: 이름, 휴대폰 번호, 이메일 · 목적: 결제 처리·결제 내역 안내·환불 · 보유 기간: 전자상거래법에
            따라 5년 · 처리위탁: 포트원(PortOne) 및 연동 PG사. 동의를 거부할 수 있으며, 거부 시 결제가
            제한됩니다. 결제를 진행하면{" "}
            <Link href="/terms" target="_blank" className="underline hover:text-foreground">
              이용약관
            </Link>
            의 환불 조항과{" "}
            <Link href="/privacy" target="_blank" className="underline hover:text-foreground">
              개인정보처리방침
            </Link>
            을 확인한 것으로 봅니다.
          </span>
        </span>
      </label>

      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={paying}
        className="w-full rounded-lg bg-accent py-4 font-medium text-white transition hover:bg-accent/80 disabled:opacity-50"
      >
        {paying ? "결제 진행 중..." : "카드로 결제하기"}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: 결제 페이지** — `app/pay/[token]/page.tsx`

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import {
  PAYMENT_REQUEST_VIEW_MESSAGE,
  isValidPaymentRequestToken,
  maskName,
  paymentRequestView,
} from "@/lib/payment-request";
import { PRICE_NOTE, RECEIPT_NOTE, SITE_INFO } from "@/lib/site-config";
import PaymentRequestCheckout from "@/components/payment-request-checkout";

export const metadata: Metadata = {
  title: "결제 요청",
  robots: { index: false, follow: false },
};

const VIEW_LIMIT = 60;
const VIEW_WINDOW_MS = 10 * 60 * 1000;

function Notice({ title, message }: { title: string; message: string }) {
  return (
    <div className="mx-auto max-w-md px-4 py-24">
      <div className="rounded-2xl border border-line bg-surface p-10 text-center">
        <h1 className="text-xl font-bold">{title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">{message}</p>
        <p className="mt-6 text-xs text-muted">
          문의: {SITE_INFO.phone} · {SITE_INFO.email}
        </p>
        <Link href="/" className="mt-6 inline-block text-sm text-muted hover:text-foreground">
          홈으로
        </Link>
      </div>
    </div>
  );
}

/** 비회원 단건 결제 페이지 — 로그인 없이 링크 토큰으로 접근 */
export default async function PaymentRequestPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const headerStore = await headers();
  if (!checkRateLimit(`pay-view:${getClientIp(headerStore)}`, VIEW_LIMIT, VIEW_WINDOW_MS).ok) {
    return <Notice title="잠시 후 다시 시도해 주세요" message="요청이 너무 많습니다." />;
  }

  // 형식 오류와 없는 토큰을 구분하지 않는다
  const request = isValidPaymentRequestToken(token)
    ? await prisma.paymentRequest.findUnique({ where: { token } })
    : null;
  if (!request) {
    return (
      <Notice
        title="결제 요청을 찾을 수 없습니다"
        message="링크가 올바른지 확인하거나 문자를 보낸 담당자에게 문의해 주세요."
      />
    );
  }

  const view = paymentRequestView(request);
  if (view !== "payable") {
    return <Notice title="결제할 수 없는 요청입니다" message={PAYMENT_REQUEST_VIEW_MESSAGE[view]} />;
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 md:py-16">
      <h1 className="text-2xl font-bold">결제 요청</h1>
      <p className="mt-2 text-sm text-muted">
        {SITE_INFO.companyName}에서 {maskName(request.recipientName)}님께 요청한 결제입니다.
      </p>

      <div className="mt-6 rounded-2xl border border-line bg-surface p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="font-bold">{request.title}</p>
            {request.memo && <p className="mt-1 text-sm text-muted">{request.memo}</p>}
            <p className="mt-2 text-xs text-muted">
              결제 가능 기간: {request.expiresAt.toLocaleString("ko-KR")}까지
            </p>
          </div>
          <div className="shrink-0 sm:text-right">
            <p className="text-2xl font-bold">
              {request.amount.toLocaleString()}
              <span className="ml-1 text-sm font-normal text-muted">원</span>
            </p>
            <p className="mt-0.5 text-xs text-muted">{PRICE_NOTE}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-line bg-surface p-6 text-sm">
        <p className="font-bold">결제 전 확인 사항</p>
        <dl className="mt-3 flex flex-col gap-2 break-keep text-muted">
          <div className="flex gap-3">
            <dt className="w-20 shrink-0">환불</dt>
            <dd>결제 취소·환불이 필요하면 고객센터로 문의해 주세요. 확인 후 결제 수단으로 환불됩니다.</dd>
          </div>
          <div className="flex gap-3">
            <dt className="w-20 shrink-0">증빙</dt>
            <dd>{RECEIPT_NOTE}</dd>
          </div>
          <div className="flex gap-3">
            <dt className="w-20 shrink-0">판매자</dt>
            <dd>
              {SITE_INFO.companyName} · 대표 {SITE_INFO.ceo} · 사업자등록번호 {SITE_INFO.businessNumber} ·{" "}
              {SITE_INFO.phone}
            </dd>
          </div>
        </dl>
      </div>

      <div className="mt-6">
        <PaymentRequestCheckout token={token} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 결과 페이지** — `app/pay/[token]/complete/page.tsx`

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { isValidPaymentRequestToken } from "@/lib/payment-request";
import { syncPaymentFromPortOne, type PaymentSyncResult } from "@/lib/payment-sync";

export const metadata: Metadata = {
  title: "결제 결과",
  robots: { index: false, follow: false },
};

const RESULT_LIMIT = 30;
const RESULT_WINDOW_MS = 10 * 60 * 1000;

/** 포트원 오류 코드는 표시용으로 영문·숫자·밑줄·하이픈만 남긴다 */
function safeCode(code: string) {
  return code.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40);
}

export default async function PaymentRequestCompletePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ paymentId?: string; code?: string; message?: string }>;
}) {
  const { token } = await params;
  const { paymentId, code, message } = await searchParams;

  const headerStore = await headers();
  if (!checkRateLimit(`pay-result:${getClientIp(headerStore)}`, RESULT_LIMIT, RESULT_WINDOW_MS).ok) {
    return <ResultCard token={token} ok={false} message="요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." />;
  }

  if (!isValidPaymentRequestToken(token) || !paymentId || paymentId.length > 100) {
    return <ResultCard token={token} ok={false} message="결제 정보가 올바르지 않습니다." />;
  }

  // 이 링크의 결제 요청 주문인지 확인 (다른 주문번호로 결제 동기화를 유발하지 못하게)
  const order = await prisma.order.findUnique({
    where: { orderId: paymentId },
    include: { paymentRequest: true },
  });
  if (!order || !order.paymentRequest || order.paymentRequest.token !== token) {
    return <ResultCard token={token} ok={false} message="결제 정보를 찾을 수 없습니다." />;
  }
  const title = order.paymentRequest.title;

  if (order.status === "PAID") {
    return <ResultCard token={token} ok message={`${title} 결제가 완료되었습니다.`} />;
  }

  if (code) {
    await prisma.order.updateMany({
      where: { orderId: paymentId, status: "PENDING" },
      data: { status: "FAILED", failReason: (message ?? `결제 실패 (${safeCode(code)})`).slice(0, 200) },
    });
    return (
      <ResultCard
        token={token}
        ok={false}
        message="결제가 완료되지 않았습니다. 다시 시도해 주세요."
        code={safeCode(code)}
      />
    );
  }

  let result: PaymentSyncResult;
  try {
    result = await syncPaymentFromPortOne(paymentId, { source: "success_page" });
  } catch (e) {
    console.error("[pay] 결제 확인 실패", paymentId, e);
    return (
      <ResultCard
        token={token}
        ok={false}
        title="결제 확인 지연"
        message="결제 확인 중 일시적인 오류가 발생했습니다. 결제가 완료되었다면 잠시 후 자동으로 반영됩니다."
      />
    );
  }

  switch (result.status) {
    case "paid":
      return <ResultCard token={token} ok message={`${title} 결제가 완료되었습니다.`} />;
    case "pending":
      return <ResultCard token={token} ok={false} title="결제 확인 중" message={result.message} />;
    case "refunded":
      return <ResultCard token={token} ok={false} title="자동 환불" message={result.message} />;
    case "canceled":
      return <ResultCard token={token} ok={false} title="취소된 결제" message={result.message} />;
    case "failed":
      return <ResultCard token={token} ok={false} message={result.message} />;
    default:
      return <ResultCard token={token} ok={false} message="결제 정보를 찾을 수 없습니다." />;
  }
}

function ResultCard({
  token,
  ok,
  message,
  title,
  code,
}: {
  token: string;
  ok: boolean;
  message: string;
  title?: string;
  code?: string;
}) {
  return (
    <div className="mx-auto max-w-md px-4 py-24">
      <div className="rounded-2xl border border-line bg-surface p-10 text-center">
        <div
          className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full text-3xl ${
            ok ? "bg-accent/15 text-accent" : "bg-red-500/15 text-red-400"
          }`}
        >
          {ok ? "✓" : "✕"}
        </div>
        <h1 className="mt-6 text-xl font-bold">{title ?? (ok ? "결제 완료" : "결제 실패")}</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">{message}</p>
        {ok && <p className="mt-2 text-xs text-muted">카드 매출전표는 입력하신 이메일로 발송됩니다.</p>}
        {code && <p className="mt-2 text-xs text-muted">오류 코드: {code}</p>}
        <div className="mt-8 flex flex-col gap-3">
          {!ok && isValidPaymentRequestToken(token) && (
            <Link
              href={`/pay/${token}`}
              className="rounded-lg bg-accent py-3 font-medium text-white transition hover:bg-accent/80"
            >
              결제 페이지로 돌아가기
            </Link>
          )}
          <Link href="/" className="text-sm text-muted hover:text-foreground">
            홈으로
          </Link>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: 캐시 금지·수집 제외**

`next.config.ts`의 `headers()` 배열에 추가:
```ts
      { source: "/pay/:path*", headers: noStoreHeaders },
```
`app/robots.ts`의 disallow 배열 → `["/api/", "/mypage", "/checkout/", "/pay/", "/login", "/register"]`

- [ ] **Step 6: 개인정보처리방침** — `app/privacy/page.tsx`

1번 섹션 `items`에서 `"도입 문의 (선택)"` 항목 뒤에 추가:
```ts
      {
        label: "비회원 결제 요청",
        value: "받는 분 이름·휴대폰 번호(담당자 입력), 결제 시 입력한 이메일, 결제 요청 항목·금액",
      },
```
2번 섹션 `items`에서 `"상품 판매"` 뒤에 추가:
```ts
      { label: "비회원 결제", value: "결제 요청 문자 안내, 결제 처리, 결제 내역 확인·환불" },
```
3번 섹션 `items`에서 `"도입 문의"` 앞에 추가:
```ts
      {
        label: "비회원 결제 요청",
        value: "전자상거래 등에서의 소비자보호에 관한 법률에 따른 대금결제 및 재화 등의 공급에 관한 기록으로 5년 보관",
      },
```
5번 섹션 솔라피 항목 value 교체:
```ts
        value: "문자 발송(회원가입 인증번호, 관리자 로그인 인증번호, 청구서·단건 결제 요청 안내) — 휴대폰 번호, 문자 내용",
```

- [ ] **Step 7: 검증** — Run: `npx tsc --noEmit` → exit 0; `npx eslint app/pay app/api/pay components/payment-request-checkout.tsx` → 오류 없음

- [ ] **Step 8: Commit** — `feat: 비회원 결제 페이지와 결제 요청 주문 API`

---

### Task 5: 전체 검증 (빌드·로컬 실행)

**Files:** 없음 (검증만, 스모크 스크립트는 scratchpad에 둔다)

- [ ] **Step 1: 정적 검증**

Run: `npx tsc --noEmit; npm test; npx eslint; npm run build`
Expected: tsc 출력 없음, test fail 0, eslint는 기존 `prisma/seed.js` require 오류 2건만, build 성공 (`/pay/[token]`, `/pay/[token]/complete`, `/api/pay/[token]/order`, `/optix-dev/payment-requests` 경로 표시)

- [ ] **Step 2: 로컬 서버 기동** — 백그라운드로 `npm run start` (포트 12000), 포트가 열릴 때까지 대기

- [ ] **Step 3: 테스트 데이터 생성** (관리자 UI는 문자 2FA가 필요하므로 DB로 직접 생성)

```powershell
node --env-file=.env -e "const {PrismaClient}=require('@prisma/client');const {randomBytes}=require('crypto');const p=new PrismaClient();(async()=>{const mk=(o)=>p.paymentRequest.create({data:{token:randomBytes(32).toString('base64url'),title:'스모크 구축비',amount:150000,recipientName:'홍길동',recipientPhone:'01099990000',expiresAt:new Date(Date.now()+864e5),createdById:'smoke',createdByUsername:'smoke',...o}});const a=await mk({});const b=await mk({status:'CANCELED'});const c=await mk({expiresAt:new Date(Date.now()-1000)});console.log(JSON.stringify({payable:a.token,canceled:b.token,expired:c.token}));await p.$disconnect();})()"
```

- [ ] **Step 4: HTTP 확인** (PowerShell `Invoke-WebRequest -UseBasicParsing`)
  - `GET /pay/{payable}` → 200, 본문에 `홍*동`과 `150,000` 포함, `홍길동` 미포함, 응답 헤더 `Cache-Control: no-store`
  - `GET /pay/{canceled}` → 본문에 "취소된 결제 요청"
  - `GET /pay/{expired}` → 본문에 "유효기간이 지난"
  - `GET /pay/invalid-token` → 본문에 "결제 요청을 찾을 수 없습니다"
  - `POST /api/pay/{payable}/order` `{"email":"a@b.co","agree":false}` → 400
  - `POST /api/pay/{payable}/order` `{"email":"a@b.co","agree":true}` → 200, `amount`=150000, `customerName`=홍길동
  - `POST /api/pay/{canceled}/order` (정상 본문) → 409, `POST /api/pay/{expired}/order` → 409
  - 같은 토큰으로 11번째 POST → 429
  - `GET /optix-dev/payment-requests` (비로그인) → 307 `/login?callbackUrl=/optix-dev`
  - `GET /robots.txt` → `/pay/` 포함
  - DB: 생성된 주문 `userId` null, `paymentRequestId` 설정, `status` PENDING

- [ ] **Step 5: 정리** — 서버 종료, 스모크 데이터 삭제:
```powershell
node --env-file=.env -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();(async()=>{const r=await p.paymentRequest.findMany({where:{createdById:'smoke'},select:{id:true}});const ids=r.map(x=>x.id);await p.order.deleteMany({where:{paymentRequestId:{in:ids}}});await p.paymentRequest.deleteMany({where:{id:{in:ids}}});console.log('deleted',ids.length);await p.$disconnect();})()"
```

- [ ] **Step 6: 결과 보고** — 실패 항목이 있으면 원인 수정 후 해당 Task 커밋에 이어서 커밋
