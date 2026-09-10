import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { invoiceOrderName } from "@/lib/billing";

export const metadata = { title: "관리자 대시보드" };

const ORDER_STATUS: Record<string, { label: string; className: string }> = {
  PENDING: { label: "결제 대기", className: "bg-yellow-500/15 text-yellow-400" },
  PAID: { label: "결제 완료", className: "bg-accent/15 text-accent" },
  FAILED: { label: "결제 실패", className: "bg-red-500/15 text-red-400" },
  CANCELED: { label: "취소됨", className: "bg-muted/15 text-muted" },
};

export default async function AdminDashboardPage() {
  const [userCount, productCount, paidOrders, recentOrders, recentUsers] =
    await Promise.all([
      prisma.user.count({ where: { status: { not: "WITHDRAWN" } } }),
      prisma.product.count(),
      prisma.order.findMany({ where: { status: "PAID" } }),
      prisma.order.findMany({
        include: { user: true, product: true, invoice: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.user.findMany({
        where: { status: { not: "WITHDRAWN" } },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

  const totalRevenue = paidOrders.reduce((sum, order) => sum + order.amount, 0);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthRevenue = paidOrders
    .filter((order) => order.paidAt && order.paidAt >= monthStart)
    .reduce((sum, order) => sum + order.amount, 0);

  const stats = [
    { label: "전체 회원", value: `${userCount.toLocaleString()}명` },
    { label: "결제 완료 주문", value: `${paidOrders.length.toLocaleString()}건` },
    { label: "이번 달 매출", value: `${monthRevenue.toLocaleString()}원` },
    { label: "누적 매출", value: `${totalRevenue.toLocaleString()}원` },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold">대시보드</h1>

      <div className="mt-8 grid gap-4 md:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-line bg-surface p-6">
            <p className="text-sm text-muted">{stat.label}</p>
            <p className="mt-2 text-2xl font-bold">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* 최근 주문 */}
        <div className="rounded-2xl border border-line bg-surface p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">최근 주문</h2>
            <Link href="/optix-dev/orders" className="text-xs text-accent hover:underline">
              전체 보기 →
            </Link>
          </div>
          {recentOrders.length === 0 ? (
            <p className="mt-4 text-sm text-muted">주문이 없습니다.</p>
          ) : (
            <ul className="mt-4 flex flex-col divide-y divide-line/50">
              {recentOrders.map((order) => {
                const badge = ORDER_STATUS[order.status];
                return (
                  <li
                    key={order.id}
                    className="flex items-center justify-between gap-4 py-3 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {order.product
                          ? order.product.name
                          : order.invoice
                            ? `[월결제] ${invoiceOrderName(order.invoice.title, order.invoice.billingMonth)}`
                            : "—"}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted">
                        {order.user.name} ·{" "}
                        {order.createdAt.toLocaleString("ko-KR")}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span>{order.amount.toLocaleString()}원</span>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* 최근 가입 회원 */}
        <div className="rounded-2xl border border-line bg-surface p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">최근 가입 회원</h2>
            <Link href="/optix-dev/users" className="text-xs text-accent hover:underline">
              전체 보기 →
            </Link>
          </div>
          {recentUsers.length === 0 ? (
            <p className="mt-4 text-sm text-muted">회원이 없습니다.</p>
          ) : (
            <ul className="mt-4 flex flex-col divide-y divide-line/50">
              {recentUsers.map((user) => (
                <li
                  key={user.id}
                  className="flex items-center justify-between gap-4 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{user.name}</p>
                    <p className="mt-0.5 truncate text-xs text-muted">{user.username}</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted">
                    {user.createdAt.toLocaleDateString("ko-KR")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <p className="mt-6 text-xs text-muted">
        등록 상품 {productCount}개 ·{" "}
        <Link href="/optix-dev/products" className="text-accent hover:underline">
          상품관리로 이동
        </Link>
      </p>
    </div>
  );
}
