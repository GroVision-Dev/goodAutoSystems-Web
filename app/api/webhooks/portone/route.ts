import { NextResponse } from "next/server";
import { PortOneWebhookError, verifyPortOneWebhook } from "@/lib/portone-webhook";
import { syncPaymentFromPortOne } from "@/lib/payment-sync";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { writeAudit } from "@/lib/audit";
import { alertAdmin } from "@/lib/alert";

/**
 * 포트원 V2 웹훅 수신 (포트원 콘솔 > 결제 연동 > 웹훅에 https://<도메인>/api/webhooks/portone 등록, 버전 2024-04-25).
 * 서명(PORTONE_WEBHOOK_SECRET)을 검증한 뒤, 본문의 금액·상태는 믿지 않고 결제 단건 조회로 주문에 반영한다.
 * 응답: 200 처리(또는 무시) / 400 서명 오류 / 500 일시 오류(포트원이 재전송) / 503 미설정
 */
export async function POST(request: Request) {
  const secret = process.env.PORTONE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[webhook] PORTONE_WEBHOOK_SECRET가 설정되지 않아 웹훅을 처리할 수 없습니다.");
    return NextResponse.json({ error: "webhook not configured" }, { status: 503 });
  }

  // 서명 검증에는 가공하지 않은 원문이 필요하다
  const rawBody = await request.text();

  let payload;
  try {
    payload = verifyPortOneWebhook(secret, rawBody, request.headers);
  } catch (e) {
    const reason = e instanceof PortOneWebhookError ? e.reason : "UNKNOWN";
    const ip = getClientIp(request);
    // 위조 요청 폭주 시 감사 로그·알림이 무한히 쌓이지 않도록 IP당 기록 수를 제한한다
    if (checkRateLimit(`webhook-invalid:${ip}`, 20, 10 * 60 * 1000).ok) {
      await writeAudit({
        action: "WEBHOOK_SIGNATURE_INVALID",
        detail: { reason },
        ip,
        userAgent: request.headers.get("user-agent"),
      });
      await alertAdmin("webhook-invalid", `포트원 웹훅 서명 검증 실패 (${reason}, IP ${ip})`);
    }
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  if (!payload.type.startsWith("Transaction.")) {
    return NextResponse.json({ ok: true, ignored: payload.type });
  }

  const paymentId = payload.data?.paymentId;
  if (typeof paymentId !== "string" || !paymentId) {
    console.warn("[webhook] paymentId 없는 결제 이벤트", payload.type);
    return NextResponse.json({ ok: true, ignored: "no paymentId" });
  }

  const storeId = process.env.NEXT_PUBLIC_PORTONE_STORE_ID;
  if (storeId && payload.data?.storeId && payload.data.storeId !== storeId) {
    console.warn("[webhook] 다른 상점의 웹훅 무시", payload.data.storeId, paymentId);
    return NextResponse.json({ ok: true, ignored: "store mismatch" });
  }

  try {
    const result = await syncPaymentFromPortOne(paymentId, { source: "webhook" });
    if (result.status === "not_found") {
      console.warn("[webhook] 주문을 찾을 수 없는 결제", payload.type, paymentId);
    }
    return NextResponse.json({ ok: true, result: result.status });
  } catch (e) {
    console.error("[webhook] 결제 동기화 실패 (포트원이 재전송)", payload.type, paymentId, e);
    return NextResponse.json({ error: "temporary failure" }, { status: 500 });
  }
}
