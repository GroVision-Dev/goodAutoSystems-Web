"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * 우하단 상시 노출 문의 버튼.
 * - 관리자 화면에서는 표시하지 않음
 * - 상품 상세 페이지는 모바일에서 하단 고정 구매 바가 있어 lg 미만에서는 숨김
 */
export default function FloatingContact() {
  const pathname = usePathname();
  if (pathname.startsWith("/optix-dev")) return null;

  const onProductDetail = /^\/products\/[^/]+/.test(pathname);

  return (
    <Link
      href="/#contact"
      className={`fixed bottom-4 right-4 z-40 items-center gap-2 rounded-full bg-accent px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-accent/30 transition hover:bg-accent/80 md:bottom-6 md:right-6 md:px-5 md:py-3 ${
        onProductDetail ? "hidden lg:flex" : "flex"
      }`}
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
      </span>
      도입 문의
    </Link>
  );
}
