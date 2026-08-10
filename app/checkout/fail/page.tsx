import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "결제 실패" };

interface SearchParams {
  code?: string;
  message?: string;
  orderId?: string;
}

export default async function CheckoutFailPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { code, message, orderId } = await searchParams;

  if (orderId) {
    await prisma.order
      .updateMany({
        where: { orderId, status: "PENDING" },
        data: { status: "FAILED", failReason: message ?? code ?? "결제 실패" },
      })
      .catch(() => null);
  }

  return (
    <div className="mx-auto max-w-md px-4 py-24">
      <div className="rounded-2xl border border-line bg-surface p-10 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-500/15 text-3xl text-red-400">
          ✕
        </div>
        <h1 className="mt-6 text-xl font-bold">결제에 실패했습니다</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          {message ?? "결제 진행 중 문제가 발생했습니다. 다시 시도해 주세요."}
        </p>
        {code && <p className="mt-2 text-xs text-muted">오류 코드: {code}</p>}
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
