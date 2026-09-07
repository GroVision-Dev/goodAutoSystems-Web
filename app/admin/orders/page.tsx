import { prisma } from "@/lib/prisma";
import AdminOrderCancel from "@/components/admin-order-cancel";
import { invoiceOrderName } from "@/lib/billing";

export const metadata = { title: "주문내역" };

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  PENDING: { label: "결제 대기", className: "bg-yellow-500/15 text-yellow-400" },
  PAID: { label: "결제 완료", className: "bg-accent/15 text-accent" },
  FAILED: { label: "결제 실패", className: "bg-red-500/15 text-red-400" },
  CANCELED: { label: "취소됨", className: "bg-muted/15 text-muted" },
};

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q, status } = await searchParams;

  const orders = await prisma.order.findMany({
    where: {
      ...(status && status in STATUS_LABEL
        ? { status: status as "PENDING" | "PAID" | "FAILED" | "CANCELED" }
        : {}),
      ...(q
        ? {
            OR: [
              { orderId: { contains: q } },
              { user: { username: { contains: q } } },
              { user: { name: { contains: q } } },
              { product: { name: { contains: q } } },
              { invoice: { title: { contains: q } } },
            ],
          }
        : {}),
    },
    include: { user: true, product: true, invoice: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const paidTotal = orders
    .filter((order) => order.status === "PAID")
    .reduce((sum, order) => sum + order.amount, 0);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">주문내역</h1>
        <form className="flex gap-2 text-sm">
          <select
            name="status"
            defaultValue={status ?? ""}
            className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-foreground focus:border-accent focus:outline-none"
          >
            <option value="">전체 상태</option>
            <option value="PAID">결제 완료</option>
            <option value="PENDING">결제 대기</option>
            <option value="FAILED">결제 실패</option>
            <option value="CANCELED">취소됨</option>
          </select>
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="주문번호/회원/상품 검색"
            className="w-52 rounded-lg border border-line bg-surface-2 px-3 py-2 text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-lg bg-accent px-4 py-2 font-medium text-white transition hover:bg-accent/80"
          >
            검색
          </button>
        </form>
      </div>

      <p className="mt-4 text-sm text-muted">
        조회 결과 {orders.length}건 · 결제 완료 합계{" "}
        <span className="font-bold text-foreground">
          {paidTotal.toLocaleString()}원
        </span>
      </p>

      <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-muted">
              <th className="p-4 font-normal">주문번호</th>
              <th className="p-4 font-normal">회원</th>
              <th className="p-4 font-normal">상품</th>
              <th className="p-4 font-normal">금액</th>
              <th className="p-4 font-normal">상태</th>
              <th className="p-4 font-normal">결제수단</th>
              <th className="p-4 font-normal">주문일시</th>
              <th className="p-4 font-normal">관리</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-muted">
                  조건에 맞는 주문이 없습니다.
                </td>
              </tr>
            ) : (
              orders.map((order) => {
                const badge = STATUS_LABEL[order.status];
                return (
                  <tr key={order.id} className="border-b border-line/50 align-top">
                    <td className="p-4 font-mono text-xs">{order.orderId}</td>
                    <td className="p-4">
                      {order.user.name}
                      <span className="block text-xs text-muted">
                        {order.user.username}
                      </span>
                    </td>
                    <td className="p-4">
                      {order.product ? (
                        order.product.name
                      ) : order.invoice ? (
                        <>
                          <span className="mr-2 rounded-full bg-accent-2/15 px-2 py-0.5 text-[10px] text-accent-2">
                            월결제
                          </span>
                          {invoiceOrderName(order.invoice.title, order.invoice.billingMonth)}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-4">{order.amount.toLocaleString()}원</td>
                    <td className="p-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                      {order.status === "CANCELED" && order.failReason && (
                        <span className="mt-1 block text-xs text-muted">
                          {order.failReason}
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-muted">{order.method ?? "-"}</td>
                    <td className="p-4 text-muted">
                      {order.createdAt.toLocaleString("ko-KR")}
                    </td>
                    <td className="p-4">
                      {order.status === "PAID" && (
                        <AdminOrderCancel orderId={order.orderId} />
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
