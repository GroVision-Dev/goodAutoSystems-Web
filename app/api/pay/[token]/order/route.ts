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
