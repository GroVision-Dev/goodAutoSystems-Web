"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isNavActive } from "@/components/nav-link";

export interface ProductMenuItem {
  slug: string;
  name: string;
  summary: string;
  category: "PROGRAM" | "AI_SERVICE";
  priceLabel: string;
}

const CATEGORY_LABEL: Record<ProductMenuItem["category"], string> = {
  PROGRAM: "데스크톱 프로그램",
  AI_SERVICE: "AI 자동화 서비스",
};

/**
 * 데스크톱 헤더의 "상품소개" 메뉴.
 * 마우스를 올리거나 키보드 포커스가 들어오면 아래로 상품 목록 드롭다운이 열린다.
 * 링크 자체는 /products로 이동하므로 드롭다운 없이도 동작한다.
 */
export default function ProductsMenu({
  products,
  className,
  activeClassName,
  inactiveClassName,
}: {
  products: ProductMenuItem[];
  className: string;
  activeClassName: string;
  inactiveClassName: string;
}) {
  const pathname = usePathname();
  const active = isNavActive(pathname, "/products");
  const groups = (["PROGRAM", "AI_SERVICE"] as const)
    .map((category) => ({
      category,
      items: products.filter((p) => p.category === category),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="group relative">
      <Link
        href="/products"
        aria-haspopup="true"
        aria-current={active ? "page" : undefined}
        className={`${className} ${active ? activeClassName : inactiveClassName} gap-1`}
      >
        상품소개
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className="mt-px opacity-60 transition group-hover:rotate-180 group-focus-within:rotate-180"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </Link>

      {products.length > 0 && (
        <div
          role="menu"
          aria-label="상품 목록"
          className="invisible absolute left-1/2 top-full z-50 w-[22rem] -translate-x-1/2 pt-1 opacity-0 transition duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
        >
          <div className="overflow-hidden rounded-2xl border border-line bg-background/95 shadow-2xl shadow-black/40 backdrop-blur">
            {groups.map((group) => (
              <div key={group.category} className="border-b border-line/60 last:border-0">
                <p className="px-4 pt-3 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted">
                  {CATEGORY_LABEL[group.category]}
                </p>
                <ul className="px-2 pb-2">
                  {group.items.map((item) => {
                    const current = pathname === `/products/${item.slug}`;
                    return (
                      <li key={item.slug}>
                        <Link
                          href={`/products/${item.slug}`}
                          role="menuitem"
                          className={`flex items-start justify-between gap-3 rounded-lg px-3 py-2.5 transition hover:bg-surface ${
                            current ? "bg-surface" : ""
                          }`}
                        >
                          <span className="min-w-0">
                            <span
                              className={`block text-sm font-medium ${
                                current ? "text-accent" : "text-foreground"
                              }`}
                            >
                              {item.name}
                            </span>
                            <span className="mt-0.5 block truncate text-xs text-muted">
                              {item.summary}
                            </span>
                          </span>
                          <span className="shrink-0 whitespace-nowrap pt-0.5 text-xs text-muted">
                            {item.priceLabel}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
            <Link
              href="/products"
              role="menuitem"
              className="block bg-surface/60 px-4 py-3 text-center text-xs font-medium text-accent transition hover:bg-surface"
            >
              전체 상품 보기 →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
