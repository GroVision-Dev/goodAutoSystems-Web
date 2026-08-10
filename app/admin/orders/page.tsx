import { prisma } from "@/lib/prisma";

export const metadata = { title: "주문내역" };

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  PENDING: { label: "결제 대기", className: "bg-yellow-500/15 text-yellow-400" },
  PAID: { label: "결제 완료", className: "bg-accent/15 text-accent" },
  FAILED: { label: "결제 실패", className: "bg-red-500/15 text-red-400" },
  CANCELED: { label: "취소됨", className: "bg-muted/15 text-muted" },
};

export default async function AdminOrdersPage() {
  const orders = await prisma.order.findMany({
    include: { user: true, product: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div>
      <h1 className="text-2xl font-bold">주문내역</h1>
      <div className="mt-8 overflow-x-auto rounded-2xl border border-line bg-surface">
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
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted">
                  주문 내역이 없습니다.
                </td>
              </tr>
            ) : (
              orders.map((order) => {
                const status = STATUS_LABEL[order.status];
                return (
                  <tr key={order.id} className="border-b border-line/50">
                    <td className="p-4 font-mono text-xs">{order.orderId}</td>
                    <td className="p-4">
                      {order.user.name}
                      <span className="block text-xs text-muted">
                        {order.user.email}
                      </span>
                    </td>
                    <td className="p-4">{order.product.name}</td>
                    <td className="p-4">{order.amount.toLocaleString()}원</td>
                    <td className="p-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs ${status.className}`}
                      >
                        {status.label}
                      </span>
                    </td>
                    <td className="p-4 text-muted">{order.method ?? "-"}</td>
                    <td className="p-4 text-muted">
                      {order.createdAt.toLocaleString("ko-KR")}
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
