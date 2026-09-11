"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import NavLink from "@/components/nav-link";

interface NavItem {
  href: string;
  label: string;
}

/**
 * 모바일(md 미만) 전용 햄버거 메뉴.
 * 헤더 아래로 펼쳐지는 패널에 네비 항목과 계정 링크를 표시한다.
 * 경로가 바뀌거나 링크를 누르면 자동으로 닫힌다.
 */
export default function MobileMenu({
  items,
  isLoggedIn,
  isAdmin,
  signOutForm,
}: {
  items: NavItem[];
  isLoggedIn: boolean;
  isAdmin: boolean;
  /** 서버 액션이 연결된 로그아웃 폼 (서버 컴포넌트에서 전달) */
  signOutForm: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // 경로가 바뀌면(뒤로가기 등) 렌더 중에 닫힘 상태로 동기화
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setOpen(false);
  }

  // 패널이 열려 있을 때 뒤 페이지 스크롤 방지
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const close = () => setOpen(false);
  const linkClass = "block rounded-lg px-3 py-3 text-base transition";
  const activeClass = "bg-accent/15 font-medium text-accent";
  const inactiveClass = "text-foreground hover:bg-surface";

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label={open ? "메뉴 닫기" : "메뉴 열기"}
        aria-expanded={open}
        aria-controls="mobile-menu-panel"
        onClick={() => setOpen((v) => !v)}
        className="-mr-2 flex h-11 w-11 items-center justify-center rounded-lg text-foreground transition hover:bg-surface"
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden
        >
          {open ? (
            <>
              <path d="M6 6l12 12" />
              <path d="M18 6L6 18" />
            </>
          ) : (
            <>
              <path d="M4 7h16" />
              <path d="M4 12h16" />
              <path d="M4 17h16" />
            </>
          )}
        </svg>
      </button>

      {open && (
        <>
          {/* 배경 클릭 시 닫힘 */}
          <div
            className="fixed inset-x-0 bottom-0 top-16 z-40 bg-background/60"
            onClick={close}
            aria-hidden
          />
          <div
            id="mobile-menu-panel"
            className="absolute inset-x-0 top-full z-50 max-h-[calc(100dvh-4rem)] overflow-y-auto border-b border-line bg-background shadow-xl"
          >
            <nav aria-label="모바일 메뉴" className="mx-auto flex max-w-6xl flex-col px-4 py-3">
              {items.map((item) => (
                <NavLink
                  key={item.href}
                  href={item.href}
                  onClick={close}
                  className={linkClass}
                  activeClassName={activeClass}
                  inactiveClassName={inactiveClass}
                >
                  {item.label}
                </NavLink>
              ))}
              {isAdmin && (
                <NavLink
                  href="/optix-dev"
                  onClick={close}
                  className={linkClass}
                  activeClassName="bg-accent-2/15 font-medium text-accent-2"
                  inactiveClassName="text-accent-2 hover:bg-surface"
                >
                  관리자
                </NavLink>
              )}

              <div className="mt-3 flex gap-3 border-t border-line pt-4 pb-1 text-sm">
                {isLoggedIn ? (
                  <>
                    <NavLink
                      href="/mypage"
                      onClick={close}
                      className="flex-1 rounded-lg border py-3 text-center font-medium transition"
                      activeClassName="border-accent bg-accent/15 text-accent"
                      inactiveClassName="border-line hover:border-accent/60"
                    >
                      마이페이지
                    </NavLink>
                    <div className="flex-1">{signOutForm}</div>
                  </>
                ) : (
                  <>
                    <NavLink
                      href="/login"
                      onClick={close}
                      className="flex-1 rounded-lg border py-3 text-center font-medium transition"
                      activeClassName="border-accent bg-accent/15 text-accent"
                      inactiveClassName="border-line hover:border-accent/60"
                    >
                      로그인
                    </NavLink>
                    <Link
                      href="/register"
                      onClick={close}
                      className="flex-1 rounded-lg bg-accent py-3 text-center font-medium text-white transition hover:bg-accent/80"
                    >
                      회원가입
                    </Link>
                  </>
                )}
              </div>
            </nav>
          </div>
        </>
      )}
    </div>
  );
}
