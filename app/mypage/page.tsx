import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "마이페이지" };

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  PENDING: { label: "결제 대기", className: "bg-yellow-500/15 text-yellow-400" },
  PAID: { label: "결제 완료", className: "bg-accent/15 text-accent" },
  FAILED: { label: "결제 실패", className: "bg-red-500/15 text-red-400" },
  CANCELED: { label: "취소됨", className: "bg-muted/15 text-muted" },
};

export default async function MyPage() {
  const session = await auth();
  if (!session) redirect("/login?callbackUrl=/mypage");

  const orders = await prisma.order.findMany({
    where: { userId: session.user.id },
    include: { product: true },
    orderBy: { createdAt: "desc" },
  });

  const purchasedPrograms = orders.filter(
    (order) =>
      order.status === "PAID" &&
      order.product.category === "PROGRAM" &&
      order.product.downloadFile
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <h1 className="text-2xl font-bold">마이페이지</h1>

      {/* 내 정보 */}
      <div className="mt-8 rounded-2xl border border-line bg-surface p-6">
        <h2 className="font-bold">내 정보</h2>
        <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
          <div className="flex gap-4">
            <dt className="w-16 text-muted">이름</dt>
            <dd>{session.user.name}</dd>
          </div>
          <div className="flex gap-4">
            <dt className="w-16 text-muted">이메일</dt>
            <dd>{session.user.email}</dd>
          </div>
        </dl>
        <p className="mt-4 text-xs text-muted">
          프로그램 로그인 시 위 이메일과 비밀번호를 동일하게 사용합니다.
        </p>
      </div>

      {/* 내 프로그램 */}
      <div className="mt-6 rounded-2xl border border-line bg-surface p-6">
        <h2 className="font-bold">내 프로그램</h2>
        {purchasedPrograms.length === 0 ? (
          <p className="mt-4 text-sm text-muted">
            구매한 프로그램이 없습니다.{" "}
            <Link href="/products" className="text-accent hover:underline">
              상품 보러가기
            </Link>
          </p>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {purchasedPrograms.map((order) => (
              <li
                key={order.id}
                className="flex items-center justify-between rounded-lg border border-line bg-surface-2 px-4 py-3"
              >
                <div>
                  <p className="font-medium">{order.product.name}</p>
                  <p className="mt-1 text-xs text-muted">
                    구매일: {order.paidAt?.toLocaleDateString("ko-KR")}
                  </p>
                </div>
                <a
                  href={`/api/download/${order.productId}`}
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent/80"
                >
                  다운로드
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 주문 내역 */}
      <div className="mt-6 rounded-2xl border border-line bg-surface p-6">
        <h2 className="font-bold">주문 내역</h2>
        {orders.length === 0 ? (
          <p className="mt-4 text-sm text-muted">주문 내역이 없습니다.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-muted">
                  <th className="pb-3 pr-4 font-normal">상품</th>
                  <th className="pb-3 pr-4 font-normal">금액</th>
                  <th className="pb-3 pr-4 font-normal">상태</th>
                  <th className="pb-3 font-normal">주문일</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const status = STATUS_LABEL[order.status];
                  return (
                    <tr key={order.id} className="border-b border-line/50">
                      <td className="py-3 pr-4">{order.product.name}</td>
                      <td className="py-3 pr-4">
                        {order.amount.toLocaleString()}원
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs ${status.className}`}
                        >
                          {status.label}
                        </span>
                      </td>
                      <td className="py-3 text-muted">
                        {order.createdAt.toLocaleDateString("ko-KR")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
