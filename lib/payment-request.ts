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
