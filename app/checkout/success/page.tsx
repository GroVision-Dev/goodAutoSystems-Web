import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { invoiceOrderName } from "@/lib/billing";
import { syncPaymentFromPortOne, type PaymentSyncResult } from "@/lib/payment-sync";

export const metadata = { title: "결제 완료" };

interface SearchParams {
  paymentId?: string;
  code?: string;
  message?: string;
}

/** 포트원 오류 코드는 표시용으로 영문·숫자·밑줄만 남긴다 */
function safeCode(code: string) {
  return code.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40);
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

  // 리디렉션 방식에서 결제 실패 시 포트원이 code/message를 붙여 돌려보낸다.
  // 결제 대기 주문만 실패로 바꾸고(취소·환불된 주문은 건드리지 않음), 화면에는 URL의 문구를 그대로 띄우지 않는다.
  if (code) {
    await prisma.order.updateMany({
      where: { orderId, status: "PENDING" },
      data: {
        status: "FAILED",
        failReason: (message ?? `결제 실패 (${safeCode(code)})`).slice(0, 200),
      },
    });
    return (
      <ResultCard
        ok={false}
        message="결제가 완료되지 않았습니다. 다시 시도해 주세요."
        code={safeCode(code)}
      />
    );
  }

  let result: PaymentSyncResult;
  try {
    // 결제 위변조 검증: 포트원 결제 단건 조회로 상태·금액을 서버 주문과 대조 (웹훅과 같은 로직)
    result = await syncPaymentFromPortOne(orderId, { source: "success_page" });
  } catch (e) {
    console.error("[checkout] 결제 확인 실패", orderId, e);
    return (
      <ResultCard
        ok={false}
        title="결제 확인 지연"
        message="결제 확인 중 일시적인 오류가 발생했습니다. 결제가 완료되었다면 잠시 후 마이페이지에서 반영됩니다."
      />
    );
  }

  switch (result.status) {
    case "paid":
      return (
        <ResultCard
          ok={true}
          message={`${orderName} 결제가 완료되었습니다.`}
          productCategory={productCategory}
        />
      );
    case "pending":
      return <ResultCard ok={false} title="결제 확인 중" message={result.message} />;
    case "refunded":
      return <ResultCard ok={false} title="자동 환불" message={result.message} />;
    case "canceled":
      return <ResultCard ok={false} title="취소된 결제" message={result.message} />;
    case "failed":
      return <ResultCard ok={false} message={result.message} />;
    default:
      return <ResultCard ok={false} message="주문을 찾을 수 없습니다." />;
  }
}

function ResultCard({
  ok,
  message,
  productCategory,
  title,
  code,
}: {
  ok: boolean;
  message: string;
  productCategory?: string;
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
        <h1 className="mt-6 text-xl font-bold">
          {title ?? (ok ? "결제 완료" : "결제 실패")}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">{message}</p>
        {code && <p className="mt-2 text-xs text-muted">오류 코드: {code}</p>}
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
                href="/mypage"
                className="rounded-lg bg-accent py-3 font-medium text-white transition hover:bg-accent/80"
              >
                마이페이지에서 결제 상태 확인
              </Link>
              <Link href="/products" className="text-sm text-muted hover:text-foreground">
                상품 목록으로
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
