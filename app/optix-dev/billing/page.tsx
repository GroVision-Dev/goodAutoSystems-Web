import { prisma } from "@/lib/prisma";
import {
  INVOICE_STATUS,
  currentBillingMonth,
  formatBillingMonth,
} from "@/lib/billing";
import {
  CreateInvoiceForm,
  GenerateInvoicesForm,
} from "@/components/admin-billing-forms";
import { cancelInvoice, reopenInvoice } from "./actions";

export const metadata = { title: "월결제 관리" };

export default async function AdminBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; month?: string }>;
}) {
  const { q, status, month } = await searchParams;
  const defaultMonth = currentBillingMonth();

  const [invoices, users, monthlyUsers] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        ...(status && status in INVOICE_STATUS
          ? { status: status as "UNPAID" | "PAID" | "CANCELED" }
          : {}),
        ...(month ? { billingMonth: month } : {}),
        ...(q
          ? {
              OR: [
                { user: { username: { contains: q } } },
                { user: { name: { contains: q } } },
                { title: { contains: q } },
              ],
            }
          : {}),
      },
      include: { user: true },
      orderBy: [{ billingMonth: "desc" }, { createdAt: "desc" }],
      take: 200,
    }),
    prisma.user.findMany({
      where: { status: { not: "WITHDRAWN" } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, username: true, monthlyAmount: true, monthlyTitle: true },
    }),
    prisma.user.count({ where: { status: "ACTIVE", monthlyAmount: { gt: 0 } } }),
  ]);

  const unpaidTotal = invoices
    .filter((inv) => inv.status === "UNPAID")
    .reduce((sum, inv) => sum + inv.amount, 0);
  const paidTotal = invoices
    .filter((inv) => inv.status === "PAID")
    .reduce((sum, inv) => sum + inv.amount, 0);

  return (
    <div>
      <h1 className="text-2xl font-bold">월결제 관리</h1>
      <p className="mt-2 text-sm text-muted">
        회원별 월 결제 금액은 <a href="/optix-dev/users" className="text-accent hover:underline">회원관리</a>에서 설정합니다.
        현재 월 결제 설정 회원 {monthlyUsers.toLocaleString()}명.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-line bg-surface p-6">
          <h2 className="font-bold">청구서 일괄 생성</h2>
          <div className="mt-4">
            <GenerateInvoicesForm defaultMonth={defaultMonth} />
          </div>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-6">
          <h2 className="font-bold">개별 청구서 발행</h2>
          <div className="mt-4">
            <CreateInvoiceForm users={users} defaultMonth={defaultMonth} />
          </div>
        </div>
      </div>

      <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">청구서 목록</h2>
          <p className="mt-1 text-xs text-muted">
            조회 결과 미납 {unpaidTotal.toLocaleString()}원 · 납부 완료 {paidTotal.toLocaleString()}원
          </p>
        </div>
        <form className="flex flex-wrap gap-2 text-sm">
          <input
            type="month"
            name="month"
            defaultValue={month ?? ""}
            className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-foreground focus:border-accent focus:outline-none"
          />
          <select
            name="status"
            defaultValue={status ?? ""}
            className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-foreground focus:border-accent focus:outline-none"
          >
            <option value="">전체 상태</option>
            <option value="UNPAID">미납</option>
            <option value="PAID">납부 완료</option>
            <option value="CANCELED">취소됨</option>
          </select>
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="이름/아이디/항목 검색"
            className="w-44 rounded-lg border border-line bg-surface-2 px-3 py-2 text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-lg bg-accent px-4 py-2 font-medium text-white transition hover:bg-accent/80"
          >
            검색
          </button>
        </form>
      </div>

      <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-muted">
              <th className="p-4 font-normal">청구 월</th>
              <th className="p-4 font-normal">회원</th>
              <th className="p-4 font-normal">항목</th>
              <th className="p-4 font-normal">금액</th>
              <th className="p-4 font-normal">상태</th>
              <th className="p-4 font-normal">납부일</th>
              <th className="p-4 font-normal">관리</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted">
                  조건에 맞는 청구서가 없습니다.
                </td>
              </tr>
            ) : (
              invoices.map((inv) => {
                const badge = INVOICE_STATUS[inv.status];
                return (
                  <tr key={inv.id} className="border-b border-line/50">
                    <td className="p-4 whitespace-nowrap">{formatBillingMonth(inv.billingMonth)}</td>
                    <td className="p-4">
                      <p>{inv.user.name}</p>
                      <p className="text-xs text-muted">{inv.user.username}</p>
                    </td>
                    <td className="p-4">
                      <p>{inv.title}</p>
                      {inv.memo && <p className="text-xs text-muted">{inv.memo}</p>}
                    </td>
                    <td className="p-4 whitespace-nowrap">{inv.amount.toLocaleString()}원</td>
                    <td className="p-4">
                      <span className={`rounded-full px-2.5 py-1 text-xs ${badge.className}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="p-4 text-muted whitespace-nowrap">
                      {inv.paidAt ? inv.paidAt.toLocaleDateString("ko-KR") : "—"}
                    </td>
                    <td className="p-4">
                      {inv.status === "UNPAID" && (
                        <form
                          action={async () => {
                            "use server";
                            await cancelInvoice(inv.id);
                          }}
                        >
                          <button
                            type="submit"
                            className="rounded-lg border border-red-500/40 px-3 py-1.5 text-xs text-red-400 transition hover:bg-red-500/10"
                          >
                            취소
                          </button>
                        </form>
                      )}
                      {inv.status === "CANCELED" && (
                        <form
                          action={async () => {
                            "use server";
                            await reopenInvoice(inv.id);
                          }}
                        >
                          <button
                            type="submit"
                            className="rounded-lg border border-line px-3 py-1.5 text-xs text-muted transition hover:text-foreground"
                          >
                            복구
                          </button>
                        </form>
                      )}
                      {inv.status === "PAID" && (
                        <a
                          href={`/optix-dev/orders?q=${encodeURIComponent(inv.user.username)}`}
                          className="text-xs text-muted hover:text-foreground"
                        >
                          주문 보기
                        </a>
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
