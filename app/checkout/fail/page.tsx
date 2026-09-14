import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "결제 실패" };

interface SearchParams {
  code?: string;
  message?: string;
  orderId?: string;
  paymentId?: string;
}

export default async function CheckoutFailPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { code, message, orderId: orderIdParam, paymentId } = await searchParams;
  const orderId = orderIdParam ?? paymentId;
  // 오류 코드는 표시용으로 영문·숫자·밑줄만 남긴다 (URL 문구를 그대로 띄우지 않음)
  const safeCode = code?.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40);

  // 본인 주문의 결제 대기 건만 실패로 바꾼다 (주문번호만 알면 남의 주문을 바꿀 수 있던 문제 방지)
  if (orderId) {
    const session = await auth();
    if (session) {
      await prisma.order
        .updateMany({
          where: { orderId, userId: session.user.id, status: "PENDING" },
          data: {
            status: "FAILED",
            failReason: (message ?? (safeCode ? `결제 실패 (${safeCode})` : "결제 실패")).slice(0, 200),
          },
        })
        .catch(() => null);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-24">
      <div className="rounded-2xl border border-line bg-surface p-10 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-500/15 text-3xl text-red-400">
          ✕
        </div>
        <h1 className="mt-6 text-xl font-bold">결제에 실패했습니다</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          결제 진행 중 문제가 발생했습니다. 다시 시도해 주세요.
        </p>
        {safeCode && <p className="mt-2 text-xs text-muted">오류 코드: {safeCode}</p>}
        <div className="mt-8 flex flex-col gap-3">
          <Link
            href="/products"
            className="rounded-lg bg-accent py-3 font-medium text-white transition hover:bg-accent/80"
          >
            상품 목록으로
          </Link>
          <Link href="/" className="text-sm text-muted hover:text-foreground">
            홈으로
          </Link>
        </div>
      </div>
    </div>
  );
}
