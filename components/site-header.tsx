import Image from "next/image";
import Link from "next/link";
import { auth, signOut } from "@/auth";
import MobileMenu from "@/components/mobile-menu";
import NavLink from "@/components/nav-link";

const NAV_ITEMS = [
  { href: "/products", label: "상품소개" },
  { href: "/services", label: "서비스" },
  { href: "/about", label: "회사소개" },
  { href: "/#contact", label: "도입문의" },
];

/** 로그아웃 폼 (데스크톱 헤더와 모바일 메뉴에서 공용) */
function SignOutForm({ className }: { className: string }) {
  return (
    <form
      className="contents"
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/" });
      }}
    >
      <button type="submit" className={className}>
        로그아웃
      </button>
    </form>
  );
}

export default async function SiteHeader() {
  const session = await auth();
  const isLoggedIn = Boolean(session);
  const isAdmin = session?.user.role === "ADMIN";

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center" aria-label="Optix 홈">
          <Image
            src="/images/logo-white.png"
            alt="Optix"
            width={141}
            height={40}
            priority
            className="h-9 w-auto md:h-10"
          />
        </Link>

        <nav className="hidden items-center gap-8 text-sm md:flex">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              className="relative flex h-16 items-center transition after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-accent after:transition-opacity"
              activeClassName="font-medium text-foreground after:opacity-100"
              inactiveClassName="text-muted hover:text-foreground after:opacity-0"
            >
              {item.label}
            </NavLink>
          ))}
          {isAdmin && (
            <NavLink
              href="/optix-dev"
              className="relative flex h-16 items-center transition after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-accent-2 after:transition-opacity"
              activeClassName="font-medium text-accent-2 after:opacity-100"
              inactiveClassName="text-accent-2/80 hover:text-accent-2 after:opacity-0"
            >
              관리자
            </NavLink>
          )}
        </nav>

        {/* 데스크톱 계정 영역 */}
        <div className="hidden items-center gap-3 text-sm md:flex">
          {isLoggedIn ? (
            <>
              <NavLink
                href="/mypage"
                className="rounded-lg px-3 py-2 transition"
                activeClassName="bg-surface font-medium text-foreground"
                inactiveClassName="text-muted hover:text-foreground"
              >
                마이페이지
              </NavLink>
              <SignOutForm className="rounded-lg border border-line px-4 py-2 text-muted transition hover:text-foreground" />
            </>
          ) : (
            <>
              <NavLink
                href="/login"
                className="rounded-lg px-3 py-2 transition"
                activeClassName="bg-surface font-medium text-foreground"
                inactiveClassName="text-muted hover:text-foreground"
              >
                로그인
              </NavLink>
              <Link
                href="/register"
                className="rounded-lg bg-accent px-4 py-2 font-medium text-white transition hover:bg-accent/80"
              >
                회원가입
              </Link>
            </>
          )}
        </div>

        {/* 모바일 햄버거 메뉴 */}
        <MobileMenu
          items={NAV_ITEMS}
          isLoggedIn={isLoggedIn}
          isAdmin={isAdmin}
          signOutForm={
            <SignOutForm className="w-full rounded-lg border border-line py-3 text-center font-medium text-muted transition hover:text-foreground" />
          }
        />
      </div>
    </header>
  );
}
