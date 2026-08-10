import { prisma } from "@/lib/prisma";

export const metadata = { title: "관리자 대시보드" };

export default async function AdminDashboardPage() {
  const [userCount, productCount, paidOrders] = await Promise.all([
    prisma.user.count(),
    prisma.product.count(),
    prisma.order.findMany({ where: { status: "PAID" } }),
  ]);

  const totalRevenue = paidOrders.reduce((sum, order) => sum + order.amount, 0);

  const stats = [
    { label: "전체 회원", value: `${userCount.toLocaleString()}명` },
    { label: "등록 상품", value: `${productCount.toLocaleString()}개` },
    { label: "결제 완료 주문", value: `${paidOrders.length.toLocaleString()}건` },
    { label: "총 매출", value: `${totalRevenue.toLocaleString()}원` },
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
    </div>
  );
}
