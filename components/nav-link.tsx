"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * 현재 경로와 일치하면 강조 표시되는 헤더 네비 링크.
 * - 해시 링크("/#section")는 강조하지 않는다 (섹션 위치를 알 수 없으므로)
 * - 하위 경로(/products/xxx)도 상위 메뉴(/products)로 강조한다
 */
export function isNavActive(pathname: string, href: string): boolean {
  if (href.includes("#")) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function NavLink({
  href,
  children,
  className = "",
  activeClassName = "",
  inactiveClassName = "",
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  activeClassName?: string;
  inactiveClassName?: string;
  onClick?: () => void;
}) {
  const pathname = usePathname();
  const active = isNavActive(pathname, href);

  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`${className} ${active ? activeClassName : inactiveClassName}`.trim()}
    >
      {children}
    </Link>
  );
}
