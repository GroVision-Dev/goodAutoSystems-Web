import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

/** 관리자 경로는 검색엔진에 노출하지 않는다 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

const MENU = [
  { href: "/optix-dev", label: "대시보드" },
  { href: "/optix-dev/users", label: "회원관리" },
  { href: "/optix-dev/products", label: "상품관리" },
  { href: "/optix-dev/orders", label: "주문내역" },
  { href: "/optix-dev/billing", label: "월결제 관리" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login?callbackUrl=/optix-dev");
  if (session.user.role !== "ADMIN") redirect("/");

  return (
    <div className="mx-auto flex max-w-6xl gap-8 px-4 py-12">
      <aside className="w-44 shrink-0">
        <p className="px-3 text-xs font-bold uppercase tracking-wider text-muted">
          Admin
        </p>
        <nav className="mt-3 flex flex-col gap-1 text-sm">
          {MENU.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-muted transition hover:bg-surface hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
