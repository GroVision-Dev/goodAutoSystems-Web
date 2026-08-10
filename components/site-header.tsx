import Link from "next/link";

const NAV_ITEMS = [
  { href: "/products", label: "상품소개" },
  { href: "/services", label: "서비스" },
  { href: "/about", label: "회사소개" },
];

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white">
            G
          </span>
          <span>
            굿오토시스템즈
          </span>
        </Link>

        <nav className="hidden items-center gap-8 text-sm text-muted md:flex">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="transition hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3 text-sm">
          <Link
            href="/login"
            className="rounded-lg px-3 py-2 text-muted transition hover:text-foreground"
          >
            로그인
          </Link>
          <Link
            href="/register"
            className="rounded-lg bg-accent px-4 py-2 font-medium text-white transition hover:bg-accent/80"
          >
            회원가입
          </Link>
        </div>
      </div>
    </header>
  );
}
