import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/auth-guard";
import { logAdminView } from "@/lib/audit";
import { toggleUserStatus, toggleUserRole } from "@/app/optix-dev/actions";
import { MonthlyFeeForm } from "@/components/admin-billing-forms";
import { formatPhone } from "@/lib/phone";

export const metadata = { title: "회원관리" };

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: "활성", className: "bg-accent/15 text-accent" },
  SUSPENDED: { label: "정지", className: "bg-red-500/15 text-red-400" },
  WITHDRAWN: { label: "탈퇴", className: "bg-muted/15 text-muted" },
};

const filterClass =
  "rounded-lg border border-line bg-surface-2 px-3 py-2 text-foreground placeholder:text-muted focus:border-accent focus:outline-none";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const session = await requireAdminPage();
  const { q, status } = await searchParams;
  await logAdminView(session, "ADMIN_VIEW_USERS", { q, status });

  const users = await prisma.user.findMany({
    where: {
      ...(q
        ? {
            OR: [
              { username: { contains: q } },
              { name: { contains: q } },
              { email: { contains: q.toLowerCase() } },
              { phone: { contains: q.replace(/\D/g, "") || q } },
            ],
          }
        : {}),
      ...(status && status in STATUS_BADGE
        ? { status: status as "ACTIVE" | "SUSPENDED" | "WITHDRAWN" }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { orders: { where: { status: "PAID" } } } } },
    take: 100,
  });

  const missingEmailCount = users.filter(
    (user) => user.status !== "WITHDRAWN" && !user.email
  ).length;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">회원관리</h1>
          <p className="mt-1 text-xs text-muted">
            조회 결과 {users.length}명
            {missingEmailCount > 0 && (
              <>
                {" "}
                · <span className="text-accent-2">이메일 미등록 {missingEmailCount}명</span>
                (결제 불가)
              </>
            )}
          </p>
        </div>
        <form className="flex w-full flex-wrap gap-2 text-sm sm:w-auto">
          <select name="status" defaultValue={status ?? ""} className={filterClass}>
            <option value="">전체 상태</option>
            <option value="ACTIVE">활성</option>
            <option value="SUSPENDED">정지</option>
            <option value="WITHDRAWN">탈퇴</option>
          </select>
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="이름/아이디/이메일/휴대폰"
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

      <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="w-full min-w-[1160px] text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs text-muted">
              <th className="whitespace-nowrap px-4 py-3 font-normal">회원</th>
              <th className="whitespace-nowrap px-4 py-3 font-normal">연락처</th>
              <th className="whitespace-nowrap px-4 py-3 font-normal">구매</th>
              <th className="whitespace-nowrap px-4 py-3 font-normal">월결제 설정</th>
              <th className="whitespace-nowrap px-4 py-3 font-normal">상태</th>
              <th className="whitespace-nowrap px-4 py-3 font-normal">가입일</th>
              <th className="whitespace-nowrap px-4 py-3 font-normal">관리</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted">
                  조건에 맞는 회원이 없습니다.
                </td>
              </tr>
            ) : (
              users.map((user) => {
                const badge = STATUS_BADGE[user.status];
                const isSelf = user.id === session?.user.id;
                const isWithdrawn = user.status === "WITHDRAWN";
                return (
                  <tr key={user.id} className="border-b border-line/50 align-middle">
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{user.name}</span>
                        {user.role === "ADMIN" && (
                          <span className="rounded-full bg-accent-2/15 px-2 py-0.5 text-[10px] text-accent-2">
                            관리자
                          </span>
                        )}
                        {isSelf && (
                          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] text-muted">
                            나
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 font-mono text-xs text-muted">{user.username}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <p>{formatPhone(user.phone)}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        {user.email ?? (
                          <span className="rounded-full bg-yellow-500/15 px-2 py-0.5 text-[10px] text-yellow-400">
                            이메일 미등록
                          </span>
                        )}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">{user._count.orders}건</td>
                    <td className="px-4 py-3">
                      {isWithdrawn ? (
                        <span className="text-muted">—</span>
                      ) : (
                        <MonthlyFeeForm
                          userId={user.id}
                          amount={user.monthlyAmount}
                          title={user.monthlyTitle}
                          billingDay={user.billingDay}
                        />
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs ${badge.className}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted">
                      {user.createdAt.toLocaleDateString("ko-KR")}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {!isSelf && !isWithdrawn && (
                        <div className="flex gap-1.5">
                          <form
                            action={async () => {
                              "use server";
                              await toggleUserStatus(user.id);
                            }}
                          >
                            <button
                              type="submit"
                              className={`rounded-lg border px-2.5 py-1.5 text-xs transition ${
                                user.status === "ACTIVE"
                                  ? "border-red-500/40 text-red-400 hover:bg-red-500/10"
                                  : "border-accent/40 text-accent hover:bg-accent/10"
                              }`}
                            >
                              {user.status === "ACTIVE" ? "정지" : "해제"}
                            </button>
                          </form>
                          <form
                            action={async () => {
                              "use server";
                              await toggleUserRole(user.id);
                            }}
                          >
                            <button
                              type="submit"
                              className="rounded-lg border border-line px-2.5 py-1.5 text-xs text-muted transition hover:text-foreground"
                            >
                              {user.role === "ADMIN" ? "관리자 해제" : "관리자 지정"}
                            </button>
                          </form>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted">
        최근 가입순 최대 100명까지 표시됩니다. 더 많은 회원은 검색으로 좁혀 주세요.
      </p>
    </div>
  );
}
