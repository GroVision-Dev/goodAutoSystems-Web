import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import AccountSettings from "@/components/account-settings";
import { formatPhone } from "@/lib/phone";
import {
  INVOICE_STATUS,
  formatBillingMonth,
  formatDueDate,
  invoiceOrderName,
  isOverdue,
} from "@/lib/billing";

export const metadata: Metadata = { title: "마이페이지" };

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  PENDING: { label: "결제 대기", className: "bg-yellow-500/15 text-yellow-400" },
  PAID: { label: "결제 완료", className: "bg-accent/15 text-accent" },
  FAILED: { label: "결제 실패", className: "bg-red-500/15 text-red-400" },
  CANCELED: { label: "취소됨", className: "bg-muted/15 text-muted" },
  EXPIRED: { label: "만료", className: "bg-muted/15 text-muted" },
};

/** 관리자 화면에서 돌려보낸 사유 (lib/auth-guard.ts requireAdminPage) */
const ADMIN_NOTICE: Record<string, string> = {
  "weak-password":
    "관리자 비밀번호가 보안 정책에 맞지 않아 관리자 기능이 잠겨 있습니다. 아래 계정 설정에서 비밀번호를 변경한 뒤 관리자 메뉴를 이용하세요.",
  reauth:
    "관리자 기능은 문자 2단계 인증으로 로그인한 세션에서만 사용할 수 있습니다. 로그아웃 후 다시 로그인해 주세요.",
};

export default async function MyPage({
  searchParams,
}: {
  searchParams: Promise<{ admin?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login?callbackUrl=/mypage");
  const { admin } = await searchParams;
  const adminNotice = admin ? ADMIN_NOTICE[admin] : undefined;

  const [user, orders, invoices] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id } }),
    prisma.order.findMany({
      where: { userId: session.user.id },
      include: { product: true, invoice: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.invoice.findMany({
      where: { userId: session.user.id, status: { not: "CANCELED" } },
      orderBy: { billingMonth: "desc" },
    }),
  ]);
  if (!user) redirect("/login");

  const purchasedPrograms = orders.filter(
    (order) =>
      order.status === "PAID" &&
      order.product?.category === "PROGRAM" &&
      order.product.downloadFile
  );
  const unpaidInvoices = invoices.filter((inv) => inv.status === "UNPAID");
  const unpaidTotal = unpaidInvoices.reduce((sum, inv) => sum + inv.amount, 0);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 md:py-16">
      <h1 className="text-2xl font-bold">마이페이지</h1>
      {adminNotice && (
        <p className="mt-4 rounded-xl border border-yellow-500/40 bg-yellow-500/5 px-4 py-3 text-sm text-yellow-400">
          {adminNotice}
        </p>
      )}

      {/* 내 정보 */}
      <div className="mt-6 rounded-2xl border border-line bg-surface p-5 md:mt-8 md:p-6">
        <h2 className="font-bold">내 정보</h2>
        <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
          <div className="flex gap-4">
            <dt className="w-16 text-muted">아이디</dt>
            <dd>{user.username}</dd>
          </div>
          <div className="flex gap-4">
            <dt className="w-16 text-muted">이름</dt>
            <dd>{user.name}</dd>
          </div>
          <div className="flex gap-4">
            <dt className="w-16 text-muted">휴대폰</dt>
            <dd>{formatPhone(user.phone)}</dd>
          </div>
          <div className="flex gap-4">
            <dt className="w-16 shrink-0 text-muted">이메일</dt>
            <dd className="min-w-0 break-all">
              {user.email ?? <span className="text-accent-2">미등록 · 아래에서 등록해 주세요</span>}
            </dd>
          </div>
          <div className="flex gap-4">
            <dt className="w-16 text-muted">가입일</dt>
            <dd>{user.createdAt.toLocaleDateString("ko-KR")}</dd>
          </div>
        </dl>
        <p className="mt-4 text-xs text-muted">
          프로그램 로그인 시 위 아이디와 비밀번호를 동일하게 사용합니다.
        </p>
      </div>

      <AccountSettings name={user.name} email={user.email} />

      {/* 월 결제 */}
      {(invoices.length > 0 || user.monthlyAmount) && (
        <div className="mt-6 rounded-2xl border border-line bg-surface p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-bold">월 결제</h2>
            {user.monthlyAmount ? (
              <p className="text-xs text-muted">
                월 {user.monthlyAmount.toLocaleString()}원 ({user.monthlyTitle})
                {user.billingDay ? ` · 매월 ${user.billingDay}일 결제` : ""}
              </p>
            ) : null}
          </div>

          {unpaidInvoices.length > 0 ? (
            <div className="mt-4 rounded-xl border border-yellow-500/40 bg-yellow-500/5 px-4 py-3 text-sm">
              미납 청구서 {unpaidInvoices.length}건 · 총{" "}
              <span className="font-bold">{unpaidTotal.toLocaleString()}원</span>
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted">미납 청구서가 없습니다.</p>
          )}

          {invoices.length > 0 && (
            <ul className="mt-4 flex flex-col gap-3">
              {invoices.map((inv) => {
                const badge = INVOICE_STATUS[inv.status];
                const overdue = isOverdue(inv);
                return (
                  <li
                    key={inv.id}
                    className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-surface-2 px-4 py-3 ${
                      overdue ? "border-red-500/40" : "border-line"
                    }`}
                  >
                    <div>
                      <p className="text-xs font-medium text-accent-2">
                        {formatBillingMonth(inv.billingMonth)}
                      </p>
                      <p className="mt-0.5 font-medium">{inv.title}</p>
                      {inv.memo && <p className="mt-0.5 text-xs text-muted">{inv.memo}</p>}
                      <p className="mt-1 text-xs text-muted">
                        {inv.status === "PAID" && inv.paidAt ? (
                          `납부일: ${inv.paidAt.toLocaleDateString("ko-KR")}`
                        ) : inv.dueDate ? (
                          <>
                            결제일: {formatDueDate(inv.dueDate)}
                            {overdue && <span className="ml-1.5 text-red-400">결제일이 지났습니다</span>}
                          </>
                        ) : (
                          `발행일: ${inv.createdAt.toLocaleDateString("ko-KR")}`
                        )}
                      </p>
                    </div>
                    <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-start">
                      <p className="font-bold">{inv.amount.toLocaleString()}원</p>
                      <span className={`rounded-full px-2.5 py-1 text-xs ${badge.className}`}>
                        {badge.label}
                      </span>
                      {inv.status === "UNPAID" && (
                        <Link
                          href={`/checkout/invoice/${inv.id}`}
                          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent/80"
                        >
                          결제하기
                        </Link>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* 내 프로그램 */}
      <div className="mt-6 rounded-2xl border border-line bg-surface p-5 md:p-6">
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
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface-2 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-medium">{order.product?.name}</p>
                  <p className="mt-1 text-xs text-muted">
                    구매일: {order.paidAt?.toLocaleDateString("ko-KR")}
                  </p>
                </div>
                <a
                  href={`/api/download/${order.productId}`}
                  className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent/80"
                >
                  다운로드
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 주문 내역 */}
      <div className="mt-6 rounded-2xl border border-line bg-surface p-5 md:p-6">
        <h2 className="font-bold">주문 내역</h2>
        {orders.length === 0 ? (
          <p className="mt-4 text-sm text-muted">주문 내역이 없습니다.</p>
        ) : (
          <div className="-mx-5 mt-4 overflow-x-auto px-5 md:mx-0 md:px-0">
            <table className="w-full min-w-[480px] text-left text-sm">
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
                      <td className="py-3 pr-4">
                        {order.product
                          ? order.product.name
                          : order.invoice
                            ? `[월결제] ${invoiceOrderName(order.invoice.title, order.invoice.billingMonth)}`
                            : "—"}
                      </td>
                      <td className="whitespace-nowrap py-3 pr-4">
                        {order.amount.toLocaleString()}원
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs ${status.className}`}
                        >
                          {status.label}
                        </span>
                      </td>
                      <td className="whitespace-nowrap py-3 text-muted">
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
