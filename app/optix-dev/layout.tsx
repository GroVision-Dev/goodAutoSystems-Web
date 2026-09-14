import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/auth-guard";
import AdminNav from "@/components/admin-nav";

/** 관리자 경로는 검색엔진에 노출하지 않는다 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 비로그인·일반회원·2단계 인증 미완료·비밀번호 정책 미달 세션은 여기서 돌려보낸다
  const session = await requireAdminPage();

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 md:flex-row md:gap-8 md:py-12">
      <aside className="shrink-0 md:sticky md:top-24 md:w-44 md:self-start">
        <div className="mb-3 hidden items-center justify-between px-3 md:flex">
          <p className="text-xs font-bold uppercase tracking-wider text-muted">Admin</p>
          <span className="max-w-24 truncate text-xs text-muted" title={session.user.username}>
            {session.user.username}
          </span>
        </div>
        <AdminNav />
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
