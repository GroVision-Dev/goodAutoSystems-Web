import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { toggleUserStatus } from "@/app/admin/actions";

export const metadata = { title: "회원관리" };

export default async function AdminUsersPage() {
  const session = await auth();
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { orders: { where: { status: "PAID" } } } } },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold">회원관리</h1>
      <div className="mt-8 overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-muted">
              <th className="p-4 font-normal">이름</th>
              <th className="p-4 font-normal">이메일</th>
              <th className="p-4 font-normal">권한</th>
              <th className="p-4 font-normal">구매</th>
              <th className="p-4 font-normal">상태</th>
              <th className="p-4 font-normal">가입일</th>
              <th className="p-4 font-normal">관리</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-line/50">
                <td className="p-4">{user.name}</td>
                <td className="p-4 text-muted">{user.email}</td>
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
                  {user.status === "ACTIVE" ? (
                    <span className="rounded-full bg-accent/15 px-2.5 py-1 text-xs text-accent">
                      활성
                    </span>
                  ) : (
                    <span className="rounded-full bg-red-500/15 px-2.5 py-1 text-xs text-red-400">
                      정지
                    </span>
                  )}
                </td>
                <td className="p-4 text-muted">
                  {user.createdAt.toLocaleDateString("ko-KR")}
                </td>
                <td className="p-4">
                  {user.id !== session?.user.id && (
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
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
