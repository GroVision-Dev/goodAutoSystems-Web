import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { toggleUserStatus, toggleUserRole } from "@/app/admin/actions";
import { MonthlyFeeForm } from "@/components/admin-billing-forms";
import { formatPhone } from "@/lib/phone";

export const metadata = { title: "회원관리" };

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: "활성", className: "bg-accent/15 text-accent" },
  SUSPENDED: { label: "정지", className: "bg-red-500/15 text-red-400" },
  WITHDRAWN: { label: "탈퇴", className: "bg-muted/15 text-muted" },
};

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const session = await auth();
  const { q, status } = await searchParams;

  const users = await prisma.user.findMany({
    where: {
      ...(q
        ? {
            OR: [
              { username: { contains: q } },
              { name: { contains: q } },
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

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">회원관리</h1>
        <form className="flex gap-2 text-sm">
          <select
            name="status"
            defaultValue={status ?? ""}
            className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-foreground focus:border-accent focus:outline-none"
          >
            <option value="">전체 상태</option>
            <option value="ACTIVE">활성</option>
            <option value="SUSPENDED">정지</option>
            <option value="WITHDRAWN">탈퇴</option>
          </select>
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="이름/아이디/휴대폰 검색"
            className="w-48 rounded-lg border border-line bg-surface-2 px-3 py-2 text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-lg bg-accent px-4 py-2 font-medium text-white transition hover:bg-accent/80"
          >
            검색
          </button>
        </form>
      </div>

      <div className="mt-8 overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-muted">
              <th className="p-4 font-normal">이름</th>
              <th className="p-4 font-normal">아이디</th>
              <th className="p-4 font-normal">휴대폰</th>
              <th className="p-4 font-normal">권한</th>
              <th className="p-4 font-normal">구매</th>
              <th className="p-4 font-normal">월결제 설정</th>
              <th className="p-4 font-normal">상태</th>
              <th className="p-4 font-normal">가입일</th>
              <th className="p-4 font-normal">관리</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-8 text-center text-muted">
                  조건에 맞는 회원이 없습니다.
                </td>
              </tr>
            ) : (
              users.map((user) => {
                const badge = STATUS_BADGE[user.status];
                const isSelf = user.id === session?.user.id;
                const isWithdrawn = user.status === "WITHDRAWN";
                return (
                  <tr key={user.id} className="border-b border-line/50">
                    <td className="p-4">{user.name}</td>
                    <td className="p-4 font-mono text-xs">{user.username}</td>
                    <td className="p-4 text-muted">{formatPhone(user.phone)}</td>
                    <td className="p-4">
                      {user.role === "ADMIN" ? (
                        <span className="rounded-full bg-accent-2/15 px-2.5 py-1 text-xs text-accent-2">
                          관리자
                        </span>
                      ) : (
                        <span className="text-muted">일반</span>
                      )}
                    </td>
                    <td className="p-4">{user._count.orders}건</td>
                    <td className="p-4">
                      {isWithdrawn ? (
                        <span className="text-muted">—</span>
                      ) : (
                        <MonthlyFeeForm
                          userId={user.id}
                          amount={user.monthlyAmount}
                          title={user.monthlyTitle}
                        />
                      )}
                    </td>
                    <td className="p-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                    </td>
                    <td className="p-4 text-muted">
                      {user.createdAt.toLocaleDateString("ko-KR")}
                    </td>
                    <td className="p-4">
                      {!isSelf && !isWithdrawn && (
                        <div className="flex gap-2">
                          <form
                            action={async () => {
                              "use server";
                              await toggleUserStatus(user.id);
                            }}
                          >
                            <button
                              type="submit"
                              className={`rounded-lg border px-3 py-1.5 text-xs transition ${
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
                              className="rounded-lg border border-line px-3 py-1.5 text-xs text-muted transition hover:text-foreground"
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
    </div>
  );
}
