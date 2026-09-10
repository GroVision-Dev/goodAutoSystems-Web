"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const MENU = [
  { href: "/optix-dev", label: "대시보드", icon: "◫" },
  { href: "/optix-dev/users", label: "회원관리", icon: "👤" },
  { href: "/optix-dev/products", label: "상품관리", icon: "▦" },
  { href: "/optix-dev/orders", label: "주문내역", icon: "≡" },
  { href: "/optix-dev/billing", label: "월결제 관리", icon: "▤" },
];

/**
 * 관리자 내비게이션.
 * 데스크톱: 세로 사이드바 / 모바일: 가로 스크롤 탭. 현재 경로를 강조한다.
 */
export default function AdminNav() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/optix-dev") return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`) || pathname.startsWith(`${href}?`);
  }

  return (
    <nav
      aria-label="관리자 메뉴"
      className="-mx-4 flex gap-1 overflow-x-auto border-b border-line px-4 pb-2 text-sm md:mx-0 md:flex-col md:overflow-visible md:border-0 md:px-0 md:pb-0"
    >
      {MENU.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 transition ${
              active
                ? "bg-accent/15 font-medium text-accent"
                : "text-muted hover:bg-surface hover:text-foreground"
            }`}
          >
            <span aria-hidden className="w-4 text-center text-xs opacity-80">
              {item.icon}
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
