import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/auth-guard";
import { logAdminView } from "@/lib/audit";
import { formatPhone } from "@/lib/phone";
import { siteUrl } from "@/lib/site-url";
import {
  PAYMENT_REQUEST_DEFAULT_DAYS,
  PAYMENT_REQUEST_MAX_DAYS,
  PAYMENT_REQUEST_STATUS_LABEL,
  paymentRequestView,
} from "@/lib/payment-request";
import AdminPaymentRequestForm from "@/components/admin-payment-request-form";
import { CopyLinkButton, ResendButton } from "@/components/admin-payment-request-actions";
import { cancelPaymentRequest } from "./actions";

export const metadata = { title: "단건 결제" };

const STATUS_FILTER = ["PENDING", "PAID", "CANCELED", "EXPIRED", "REFUNDED"] as const;
type StatusFilter = (typeof STATUS_FILTER)[number];
const STATUS_FILTER_LABEL: Record<StatusFilter, string> = {
  PENDING: "결제 대기",
  PAID: "결제 완료",
  CANCELED: "취소",
  EXPIRED: "만료",
  REFUNDED: "환불",
};

const filterClass =
  "rounded-lg border border-line bg-surface-2 px-3 py-2 text-foreground placeholder:text-muted focus:border-accent focus:outline-none";

export default async function AdminPaymentRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const session = await requireAdminPage();
  const { q, status } = await searchParams;
  await logAdminView(session, "ADMIN_VIEW_PAYMENT_REQUESTS", { q, status });

  const statusFilter = STATUS_FILTER.find((s) => s === status);
  const phoneQuery = q?.replace(/\D/g, "");
  const requests = await prisma.paymentRequest.findMany({
    where: {
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(q
        ? {
            OR: [
              { recipientName: { contains: q } },
              { title: { contains: q } },
              ...(phoneQuery ? [{ recipientPhone: { contains: phoneQuery } }] : []),
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const now = new Date();
  const base = siteUrl();

  return (
    <div>
      <h1 className="text-2xl font-bold">단건 결제</h1>
      <p className="mt-2 text-sm text-muted">
        회원가입하지 않은 고객에게 항목·금액을 정해 결제 링크를 문자로 보냅니다. 고객은 로그인 없이 카드로
        결제하며, 결제 내역은{" "}
        <Link href="/optix-dev/orders" className="text-accent hover:underline">
          주문내역
        </Link>
        에서 확인·환불합니다.
      </p>

      <section className="mt-6 rounded-2xl border border-line bg-surface p-6">
        <h2 className="font-bold">결제 요청 만들기</h2>
        <div className="mt-4">
          <AdminPaymentRequestForm
            defaultDays={PAYMENT_REQUEST_DEFAULT_DAYS}
            maxDays={PAYMENT_REQUEST_MAX_DAYS}
          />
        </div>
      </section>

      <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl font-bold">요청 목록</h2>
        <form className="flex w-full flex-wrap gap-2 text-sm sm:w-auto">
          <select name="status" defaultValue={statusFilter ?? ""} className={filterClass}>
            <option value="">전체 상태</option>
            {STATUS_FILTER.map((s) => (
              <option key={s} value={s}>
                {STATUS_FILTER_LABEL[s]}
              </option>
            ))}
          </select>
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="받는 분/휴대폰/항목 검색"
            className={`${filterClass} min-w-0 flex-1 sm:w-52 sm:flex-none`}
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
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs text-muted">
              <th className="whitespace-nowrap p-4 font-normal">요청일</th>
              <th className="whitespace-nowrap p-4 font-normal">받는 분</th>
              <th className="whitespace-nowrap p-4 font-normal">항목 · 금액</th>
              <th className="whitespace-nowrap p-4 font-normal">상태</th>
              <th className="whitespace-nowrap p-4 font-normal">문자</th>
              <th className="whitespace-nowrap p-4 font-normal">관리</th>
            </tr>
          </thead>
          <tbody>
            {requests.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted">
                  결제 요청이 없습니다.
                </td>
              </tr>
            ) : (
              requests.map((req) => {
                const view = paymentRequestView(req, now);
                const badge = PAYMENT_REQUEST_STATUS_LABEL[view];
                return (
                  <tr key={req.id} className="border-b border-line/50 align-top">
                    <td className="whitespace-nowrap p-4 text-xs text-muted">
                      {req.createdAt.toLocaleString("ko-KR")}
                      <span className="block">{req.createdByUsername}</span>
                    </td>
                    <td className="whitespace-nowrap p-4">
                      {req.recipientName}
                      <span className="block text-xs text-muted">{formatPhone(req.recipientPhone)}</span>
                    </td>
                    <td className="p-4">
                      <p>{req.title}</p>
                      <p className="font-medium">{req.amount.toLocaleString()}원</p>
                      {req.memo && <p className="text-xs text-muted">{req.memo}</p>}
                    </td>
                    <td className="whitespace-nowrap p-4">
                      <span className={`rounded-full px-2.5 py-1 text-xs ${badge.className}`}>{badge.label}</span>
                      <span className="mt-1 block text-xs text-muted">
                        {req.paidAt
                          ? `결제 ${req.paidAt.toLocaleString("ko-KR")}`
                          : `유효 ~ ${req.expiresAt.toLocaleDateString("ko-KR")}`}
                      </span>
                    </td>
                    <td className="whitespace-nowrap p-4 text-xs text-muted">
                      {req.notifiedAt ? `${req.sentCount}회 · ${req.notifiedAt.toLocaleString("ko-KR")}` : "미발송"}
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap items-start gap-1.5">
                        {view === "payable" && (
                          <>
                            <CopyLinkButton url={`${base}/pay/${req.token}`} />
                            <ResendButton id={req.id} />
                          </>
                        )}
                        {(req.status === "PENDING" || req.status === "EXPIRED") && (
                          <form
                            action={async () => {
                              "use server";
                              await cancelPaymentRequest(req.id);
                            }}
                          >
                            <button
                              type="submit"
                              className="whitespace-nowrap rounded-lg border border-red-500/40 px-3 py-1.5 text-xs text-red-400 transition hover:bg-red-500/10"
                            >
                              요청 취소
                            </button>
                          </form>
                        )}
                        {(req.status === "PAID" || req.status === "REFUNDED") && (
                          <Link
                            href={`/optix-dev/orders?q=${encodeURIComponent(req.recipientName)}`}
                            className="whitespace-nowrap text-xs text-muted hover:text-foreground"
                          >
                            주문 보기
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted">
        최근 200건까지 표시됩니다. 결제 완료 건의 환불은 주문내역의 결제취소에서 진행하며, 취소한 요청에 결제가
        들어오면 자동으로 환불됩니다.
      </p>
    </div>
  );
}
