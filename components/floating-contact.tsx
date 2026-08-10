import Link from "next/link";

/** 우하단 상시 노출 문의 버튼 */
export default function FloatingContact() {
  return (
    <Link
      href="/#contact"
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-medium text-white shadow-lg shadow-accent/30 transition hover:bg-accent/80"
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
      </span>
      도입 문의
    </Link>
  );
}
