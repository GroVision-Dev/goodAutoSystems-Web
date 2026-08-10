import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { confirmPayment, TossConfirmError } from "@/lib/toss";

export const metadata = { title: "결제 완료" };

interface SearchParams {
  paymentKey?: string;
  orderId?: string;
  amount?: string;
}

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { paymentKey, orderId, amount } = await searchParams;
  if (!paymentKey || !orderId || !amount) {
    return <ResultCard ok={false} message="결제 정보가 올바르지 않습니다." />;
  }

  const order = await prisma.order.findUnique({
    where: { orderId },
    include: { product: true },
  });

  if (!order || order.userId !== session.user.id) {
    return <ResultCard ok={false} message="주문을 찾을 수 없습니다." />;
  }

  // 이미 승인된 주문이면 멱등 처리
  if (order.status === "PAID") {
    return (
      <ResultCard
        ok={true}
        message={`${order.product.name} 결제가 완료되었습니다.`}
        productCategory={order.product.category}
      />
    );
  }

  // 금액 위변조 검증: 서버에 저장된 주문 금액과 리다이렉트 파라미터 비교
  if (order.amount !== Number(amount)) {
    await prisma.order.update({
      where: { orderId },
      data: { status: "FAILED", failReason: "결제 금액 불일치" },
    });
    return <ResultCard ok={false} message="결제 금액이 일치하지 않습니다." />;
  }

  try {
    const payment = await confirmPayment(paymentKey, orderId, order.amount);
    await prisma.order.update({
      where: { orderId },
      data: {
        status: "PAID",
        paymentKey,
        method: typeof payment.method === "string" ? payment.method : null,
        paidAt: new Date(),
      },
    });
    return (
      <ResultCard
        ok={true}
        message={`${order.product.name} 결제가 완료되었습니다.`}
        productCategory={order.product.category}
      />
    );
  } catch (e) {
    const message =
      e instanceof TossConfirmError ? e.message : "결제 승인 중 오류가 발생했습니다.";
    await prisma.order.update({
      where: { orderId },
      data: { status: "FAILED", failReason: message },
    });
    return <ResultCard ok={false} message={message} />;
  }
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
