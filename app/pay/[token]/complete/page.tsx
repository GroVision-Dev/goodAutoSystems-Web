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
