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
