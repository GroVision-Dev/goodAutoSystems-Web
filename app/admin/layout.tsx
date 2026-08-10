import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

const MENU = [
  { href: "/admin", label: "대시보드" },
  { href: "/admin/users", label: "회원관리" },
  { href: "/admin/products", label: "상품관리" },
  { href: "/admin/orders", label: "주문내역" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login?callbackUrl=/admin");
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
