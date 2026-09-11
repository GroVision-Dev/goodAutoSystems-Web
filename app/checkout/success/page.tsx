import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  getPayment,
  verifyPaidPayment,
  methodLabel,
  PortOneApiError,
} from "@/lib/portone";
import { invoiceOrderName } from "@/lib/billing";
import { setupMonthlyBillingAfterPurchase } from "@/lib/monthly-purchase";

export const metadata = { title: "결제 완료" };

interface SearchParams {
  paymentId?: string;
  code?: string;
  message?: string;
}

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { paymentId, code, message } = await searchParams;
  if (!paymentId) {
    return <ResultCard ok={false} message="결제 정보가 올바르지 않습니다." />;
  }

  // 포트원 paymentId = 주문번호(orderId)
  const orderId = paymentId;
  const order = await prisma.order.findUnique({
    where: { orderId },
    include: { product: true, invoice: true },
  });

  if (!order || order.userId !== session.user.id) {
    return <ResultCard ok={false} message="주문을 찾을 수 없습니다." />;
  }

  const orderName = order.product
    ? order.product.name
    : order.invoice
      ? invoiceOrderName(order.invoice.title, order.invoice.billingMonth)
      : "주문";
  const productCategory = order.product?.category ?? (order.invoice ? "INVOICE" : undefined);

  // 이미 승인된 주문이면 멱등 처리
  if (order.status === "PAID") {
    return (
      <ResultCard
        ok={true}
        message={`${orderName} 결제가 완료되었습니다.`}
        productCategory={productCategory}
      />
    );
  }

  // 리디렉션 방식에서 결제 실패 시 포트원이 code/message를 붙여 돌려보낸다
  if (code) {
    const failReason = message ?? `결제 실패 (${code})`;
    await prisma.order.update({
      where: { orderId },
      data: { status: "FAILED", failReason },
    });
    return <ResultCard ok={false} message={failReason} />;
  }

  let failMessage: string | null = null;
  try {
    // 결제 위변조 검증: 포트원 결제 단건 조회로 상태·금액을 서버 주문과 대조
    const payment = await getPayment(paymentId);
    verifyPaidPayment(payment, order.amount);
    const paidAt = new Date();
    await prisma.$transaction([
      prisma.order.update({
        where: { orderId },
        data: {
          status: "PAID",
          paymentKey: payment.transactionId,
          method: methodLabel(payment),
          paidAt,
        },
      }),
      ...(order.invoiceId
        ? [
            prisma.invoice.update({
              where: { id: order.invoiceId },
              data: { status: "PAID", paidAt },
            }),
          ]
        : []),
    ]);

    // 월 결제 상품: 첫 달 결제 완료 → 회원 월 결제 설정 + 이번 달 청구서(납부 완료) 연결.
    // 결제 자체는 이미 확정됐으므로 여기서 실패해도 결제 완료로 처리하고 로그만 남긴다.
    if (order.product?.billingType === "MONTHLY") {
      try {
        await setupMonthlyBillingAfterPurchase({
          orderId,
          userId: order.userId,
          product: { name: order.product.name, price: order.product.price },
          paidAt,
        });
      } catch (e) {
        console.error("[checkout] 월 결제 설정 등록 실패", orderId, e);
      }
    }
  } catch (e) {
    failMessage =
      e instanceof PortOneApiError ? e.message : "결제 확인 중 오류가 발생했습니다.";
    await prisma.order.update({
      where: { orderId },
      data: { status: "FAILED", failReason: failMessage },
    });
  }

  if (failMessage) {
    return <ResultCard ok={false} message={failMessage} />;
  }
  return (
    <ResultCard
      ok={true}
      message={`${orderName} 결제가 완료되었습니다.`}
      productCategory={productCategory}
    />
  );
}

function ResultCard({
  ok,
  message,
  productCategory,
}: {
  ok: boolean;
  message: string;
  productCategory?: string;
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
        <h1 className="mt-6 text-xl font-bold">
          {ok ? "결제 완료" : "결제 실패"}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">{message}</p>
        <div className="mt-8 flex flex-col gap-3">
          {ok ? (
            <>
              <Link
                href="/mypage"
                className="rounded-lg bg-accent py-3 font-medium text-white transition hover:bg-accent/80"
              >
                {productCategory === "PROGRAM"
                  ? "마이페이지에서 다운로드"
                  : productCategory === "INVOICE"
                    ? "마이페이지에서 납부 내역 확인"
                    : "마이페이지로 이동"}
              </Link>
              <Link href="/" className="text-sm text-muted hover:text-foreground">
                홈으로
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/products"
                className="rounded-lg bg-accent py-3 font-medium text-white transition hover:bg-accent/80"
              >
                상품 목록으로
              </Link>
              <Link href="/" className="text-sm text-muted hover:text-foreground">
                홈으로
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
