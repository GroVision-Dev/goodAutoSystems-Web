import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatBillingMonth, formatDueDate } from "@/lib/billing";
import { PRICE_NOTE, RECEIPT_NOTE } from "@/lib/site-config";
import PortOneCheckout from "@/components/portone-checkout";

export const metadata: Metadata = { title: "월 결제" };

export default async function InvoiceCheckoutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session) redirect(`/login?callbackUrl=/checkout/invoice/${id}`);

  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice || invoice.userId !== session.user.id) notFound();
  if (invoice.status === "PAID") redirect("/mypage");

  if (invoice.status === "CANCELED") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <h1 className="text-2xl font-bold">월 결제</h1>
        <div className="mt-8 rounded-2xl border border-line bg-surface p-8 text-center text-sm text-muted">
          취소된 청구서입니다. 문의가 필요하면 고객센터로 연락해 주세요.
          <div className="mt-6">
            <Link href="/mypage" className="text-accent hover:underline">
              마이페이지로 돌아가기
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-2xl font-bold">월 결제</h1>

      <div className="mt-8 rounded-2xl border border-line bg-surface p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-accent-2">
              {formatBillingMonth(invoice.billingMonth)} 청구
            </p>
            <p className="mt-1 font-bold">{invoice.title}</p>
            {invoice.memo && <p className="mt-1 text-sm text-muted">{invoice.memo}</p>}
            {invoice.dueDate && (
              <p className="mt-1 text-xs text-muted">결제일: {formatDueDate(invoice.dueDate)}</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-xl font-bold">
              {invoice.amount.toLocaleString()}
              <span className="ml-1 text-sm font-normal text-muted">원</span>
            </p>
            <p className="mt-0.5 text-xs text-muted">{PRICE_NOTE}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-line bg-surface p-6 text-sm">
        <p className="font-bold">결제 전 확인 사항</p>
        <dl className="mt-3 flex flex-col gap-2 text-muted">
          <div className="flex gap-3">
            <dt className="w-24 shrink-0">결제 내용</dt>
            <dd>관리자가 발행한 {formatBillingMonth(invoice.billingMonth)} 청구서에 대한 결제입니다.</dd>
          </div>
          <div className="flex gap-3">
            <dt className="w-24 shrink-0">환불</dt>
            <dd>결제 취소가 필요하면 고객센터로 문의해 주세요. 관리자 확인 후 결제 수단으로 환불됩니다.</dd>
          </div>
          <div className="flex gap-3">
            <dt className="w-24 shrink-0">증빙</dt>
            <dd>{RECEIPT_NOTE}</dd>
          </div>
        </dl>
        <p className="mt-4 text-xs leading-relaxed text-muted">
          결제를 진행하면 위 내용과{" "}
          <Link href="/terms" className="underline hover:text-foreground">
            이용약관
          </Link>
          에 동의한 것으로 간주됩니다.
        </p>
      </div>

      <div className="mt-6">
        <PortOneCheckout invoiceId={invoice.id} />
      </div>
    </div>
  );
}
