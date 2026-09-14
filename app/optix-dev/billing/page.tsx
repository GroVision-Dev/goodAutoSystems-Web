import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  INVOICE_STATUS,
  computeDueDate,
  currentBillingMonth,
  daysUntil,
  formatBillingMonth,
  formatDueDate,
  isOverdue,
} from "@/lib/billing";
import {
  CreateInvoiceForm,
  GenerateInvoicesForm,
  IssueInvoiceButton,
  SendNoticeButton,
} from "@/components/admin-billing-forms";
import { cancelInvoice, reopenInvoice } from "./actions";
import { requireAdminPage } from "@/lib/auth-guard";
import { logAdminView } from "@/lib/audit";

export const metadata = { title: "월결제 관리" };

const filterClass =
  "rounded-lg border border-line bg-surface-2 px-3 py-2 text-foreground placeholder:text-muted focus:border-accent focus:outline-none";

function DueBadge({ days }: { days: number }) {
  if (days < 0) {
    return (
      <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] text-red-400">
        {-days}일 지남
      </span>
    );
  }
  if (days === 0) {
    return (
      <span className="rounded-full bg-accent-2/15 px-2 py-0.5 text-[11px] text-accent-2">오늘</span>
    );
  }
  return (
    <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-muted">D-{days}</span>
  );
}

export default async function AdminBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; month?: string }>;
}) {
  const session = await requireAdminPage();
  const { q, status, month } = await searchParams;
  await logAdminView(session, "ADMIN_VIEW_BILLING", { q, status, month });
  const thisMonth = currentBillingMonth();
  const now = new Date();

  const [invoices, users, scheduledUsers] = await Promise.all([
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
      orderBy: [{ billingMonth: "desc" }, { dueDate: "asc" }, { createdAt: "desc" }],
      take: 200,
    }),
    prisma.user.findMany({
      where: { status: { not: "WITHDRAWN" } },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        username: true,
        monthlyAmount: true,
        monthlyTitle: true,
        billingDay: true,
      },
    }),
    // 이번 달 결제 예정: 월 결제 설정된 활성 회원 + 이번 달 청구서 상태
    prisma.user.findMany({
      where: { status: "ACTIVE", monthlyAmount: { gt: 0 } },
      select: {
        id: true,
        name: true,
        username: true,
        phone: true,
        monthlyAmount: true,
        monthlyTitle: true,
        billingDay: true,
        invoices: {
          where: { billingMonth: thisMonth },
          select: { id: true, status: true, notifiedAt: true, dueDate: true },
          take: 1,
        },
      },
    }),
  ]);

  const scheduled = scheduledUsers
    .map((user) => {
      const dueDate = user.billingDay ? computeDueDate(thisMonth, user.billingDay) : null;
      return {
        ...user,
        dueDate,
        days: dueDate ? daysUntil(dueDate, now) : null,
        invoice: user.invoices[0] ?? null,
      };
    })
    .sort((a, b) => (a.billingDay ?? 99) - (b.billingDay ?? 99));
  const notIssued = scheduled.filter((s) => !s.invoice || s.invoice.status === "CANCELED");
  const dueSoon = notIssued.filter((s) => s.days !== null && s.days <= 3);
  const noBillingDay = scheduled.filter((s) => !s.billingDay).length;

  const unpaidTotal = invoices
    .filter((inv) => inv.status === "UNPAID")
    .reduce((sum, inv) => sum + inv.amount, 0);
  const paidTotal = invoices
    .filter((inv) => inv.status === "PAID")
    .reduce((sum, inv) => sum + inv.amount, 0);
  const overdueCount = invoices.filter((inv) => isOverdue(inv, now)).length;

  return (
    <div>
      <h1 className="text-2xl font-bold">월결제 관리</h1>
      <p className="mt-2 text-sm text-muted">
        회원별 월 결제 금액과 결제일은{" "}
        <Link href="/optix-dev/users" className="text-accent hover:underline">
          회원관리
        </Link>
        에서 설정합니다. 월 결제 설정 회원 {scheduled.length}명
        {noBillingDay > 0 && (
          <>
            {" "}
            · <span className="text-yellow-400">결제일 미설정 {noBillingDay}명</span>
          </>
        )}
      </p>

      {/* 이번 달 결제 예정 */}
      <section className="mt-8 rounded-2xl border border-line bg-surface p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-bold">{formatBillingMonth(thisMonth)} 결제 예정 회원</h2>
            <p className="mt-1 text-xs text-muted">
              결제일순. 미발행 {notIssued.length}명
              {dueSoon.length > 0 && (
                <>
                  {" "}
                  · <span className="text-accent-2">3일 내 결제일 {dueSoon.length}명</span>
                </>
              )}
            </p>
          </div>
        </div>
        {scheduled.length === 0 ? (
          <p className="mt-4 text-sm text-muted">
            월 결제가 설정된 회원이 없습니다. 회원관리에서 금액과 결제일을 먼저 설정하세요.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-2/50 text-xs text-muted">
                  <th className="whitespace-nowrap px-4 py-2.5 font-normal">결제일</th>
                  <th className="whitespace-nowrap px-4 py-2.5 font-normal">회원</th>
                  <th className="whitespace-nowrap px-4 py-2.5 font-normal">항목 · 금액</th>
                  <th className="whitespace-nowrap px-4 py-2.5 font-normal">이번 달 청구서</th>
                  <th className="whitespace-nowrap px-4 py-2.5 font-normal">발행</th>
                </tr>
              </thead>
              <tbody>
                {scheduled.map((s) => (
                  <tr key={s.id} className="border-b border-line/50 last:border-0">
                    <td className="whitespace-nowrap px-4 py-3">
                      {s.dueDate ? (
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{formatDueDate(s.dueDate)}</span>
                          {s.days !== null && (!s.invoice || s.invoice.status !== "PAID") && (
                            <DueBadge days={s.days} />
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-yellow-400">결제일 미설정</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {s.name}
                      <span className="ml-1.5 font-mono text-xs text-muted">{s.username}</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {s.monthlyTitle ?? "월 이용료"} ·{" "}
                      <span className="font-medium">{s.monthlyAmount!.toLocaleString()}원</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {s.invoice && s.invoice.status !== "CANCELED" ? (
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs ${INVOICE_STATUS[s.invoice.status].className}`}
                          >
                            {INVOICE_STATUS[s.invoice.status].label}
                          </span>
                          {s.invoice.status === "UNPAID" && (
                            <span className="text-[11px] text-muted">
                              {s.invoice.notifiedAt
                                ? `문자 ${s.invoice.notifiedAt.toLocaleDateString("ko-KR")}`
                                : "문자 미발송"}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted">미발행</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {s.invoice && s.invoice.status !== "CANCELED" ? (
                        s.invoice.status === "UNPAID" ? (
                          <SendNoticeButton
                            invoiceId={s.invoice.id}
                            notifiedAt={s.invoice.notifiedAt?.toLocaleString("ko-KR") ?? null}
                          />
                        ) : (
                          <span className="text-xs text-muted">—</span>
                        )
                      ) : (
                        <IssueInvoiceButton userId={s.id} billingMonth={thisMonth} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-line bg-surface p-6">
          <h2 className="font-bold">청구서 일괄 생성</h2>
          <div className="mt-4">
            <GenerateInvoicesForm defaultMonth={thisMonth} />
          </div>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-6">
          <h2 className="font-bold">개별 청구서 발행</h2>
          <div className="mt-4">
            <CreateInvoiceForm users={users} defaultMonth={thisMonth} />
          </div>
        </div>
      </div>

      <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">청구서 목록</h2>
          <p className="mt-1 text-xs text-muted">
            조회 결과 미납 {unpaidTotal.toLocaleString()}원 · 납부 완료 {paidTotal.toLocaleString()}원
            {overdueCount > 0 && (
              <>
                {" "}
                · <span className="text-red-400">결제일 경과 {overdueCount}건</span>
              </>
            )}
          </p>
        </div>
        <form className="flex w-full flex-wrap gap-2 text-sm lg:w-auto">
          <input
            type="month"
            name="month"
            defaultValue={month ?? ""}
            aria-label="청구 월"
            className={filterClass}
          />
          <select name="status" defaultValue={status ?? ""} className={filterClass}>
            <option value="">전체 상태</option>
            <option value="UNPAID">미납</option>
            <option value="PAID">납부 완료</option>
            <option value="CANCELED">취소됨</option>
          </select>
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="이름/아이디/항목 검색"
            className={`${filterClass} min-w-0 flex-1 sm:w-44 sm:flex-none`}
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
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs text-muted">
              <th className="whitespace-nowrap p-4 font-normal">청구 월</th>
              <th className="whitespace-nowrap p-4 font-normal">회원</th>
              <th className="whitespace-nowrap p-4 font-normal">항목</th>
              <th className="whitespace-nowrap p-4 font-normal">금액</th>
              <th className="whitespace-nowrap p-4 font-normal">결제 예정일</th>
              <th className="whitespace-nowrap p-4 font-normal">상태</th>
              <th className="whitespace-nowrap p-4 font-normal">문자</th>
              <th className="whitespace-nowrap p-4 font-normal">납부일</th>
              <th className="whitespace-nowrap p-4 font-normal">관리</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-8 text-center text-muted">
                  조건에 맞는 청구서가 없습니다.
                </td>
              </tr>
            ) : (
              invoices.map((inv) => {
                const badge = INVOICE_STATUS[inv.status];
                const overdue = isOverdue(inv, now);
                return (
                  <tr key={inv.id} className="border-b border-line/50 align-top">
                    <td className="whitespace-nowrap p-4">{formatBillingMonth(inv.billingMonth)}</td>
                    <td className="whitespace-nowrap p-4">
                      <p>{inv.user.name}</p>
                      <p className="text-xs text-muted">{inv.user.username}</p>
                    </td>
                    <td className="p-4">
                      <p>{inv.title}</p>
                      {inv.memo && <p className="text-xs text-muted">{inv.memo}</p>}
                    </td>
                    <td className="whitespace-nowrap p-4">{inv.amount.toLocaleString()}원</td>
                    <td className="whitespace-nowrap p-4">
                      {inv.dueDate ? (
                        <div className="flex items-center gap-2">
                          <span className={overdue ? "text-red-400" : ""}>
                            {formatDueDate(inv.dueDate)}
                          </span>
                          {inv.status === "UNPAID" && <DueBadge days={daysUntil(inv.dueDate, now)} />}
                        </div>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap p-4">
                      <span className={`rounded-full px-2.5 py-1 text-xs ${badge.className}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="whitespace-nowrap p-4 text-xs text-muted">
                      {inv.notifiedAt ? inv.notifiedAt.toLocaleDateString("ko-KR") : "미발송"}
                    </td>
                    <td className="whitespace-nowrap p-4 text-muted">
                      {inv.paidAt ? inv.paidAt.toLocaleDateString("ko-KR") : "—"}
                    </td>
                    <td className="p-4">
                      {inv.status === "UNPAID" && (
                        <div className="flex flex-wrap gap-1.5">
                          <SendNoticeButton
                            invoiceId={inv.id}
                            notifiedAt={inv.notifiedAt?.toLocaleString("ko-KR") ?? null}
                          />
                          <form
                            action={async () => {
                              "use server";
                              await cancelInvoice(inv.id);
                            }}
                          >
                            <button
                              type="submit"
                              className="whitespace-nowrap rounded-lg border border-red-500/40 px-3 py-1.5 text-xs text-red-400 transition hover:bg-red-500/10"
                            >
                              취소
                            </button>
                          </form>
                        </div>
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
                            className="whitespace-nowrap rounded-lg border border-line px-3 py-1.5 text-xs text-muted transition hover:text-foreground"
                          >
                            복구
                          </button>
                        </form>
                      )}
                      {inv.status === "PAID" && (
                        <Link
                          href={`/optix-dev/orders?q=${encodeURIComponent(inv.user.username)}`}
                          className="whitespace-nowrap text-xs text-muted hover:text-foreground"
                        >
                          주문 보기
                        </Link>
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
