import Image from "next/image";
import Link from "next/link";
import { auth, signOut } from "@/auth";
import MobileMenu from "@/components/mobile-menu";

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
          {isAdmin && (
            <Link href="/optix-dev" className="text-accent-2 transition hover:text-foreground">
              관리자
            </Link>
          )}
        </nav>

        {/* 데스크톱 계정 영역 */}
        <div className="hidden items-center gap-3 text-sm md:flex">
          {isLoggedIn ? (
            <>
              <Link
                href="/mypage"
                className="rounded-lg px-3 py-2 text-muted transition hover:text-foreground"
              >
                마이페이지
              </Link>
              <SignOutForm className="rounded-lg border border-line px-4 py-2 text-muted transition hover:text-foreground" />
            </>
          ) : (
            <>
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
