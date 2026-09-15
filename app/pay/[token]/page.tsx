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
