import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-col justify-between gap-8 md:flex-row">
          <div>
            <p className="text-lg font-bold">굿오토시스템즈</p>
            <p className="mt-2 text-sm text-muted">
              업무 자동화 프로그램과 AI 자동화 솔루션 전문 기업
            </p>
          </div>
          <div className="flex gap-12 text-sm">
            <div className="flex flex-col gap-2">
              <p className="font-medium">바로가기</p>
              <Link href="/products" className="text-muted hover:text-foreground">
                상품소개
              </Link>
              <Link href="/services" className="text-muted hover:text-foreground">
                서비스
              </Link>
              <Link href="/about" className="text-muted hover:text-foreground">
                회사소개
              </Link>
            </div>
            <div className="flex flex-col gap-2">
              <p className="font-medium">고객지원</p>
              <Link href="/mypage" className="text-muted hover:text-foreground">
                마이페이지
              </Link>
              <Link href="/login" className="text-muted hover:text-foreground">
                로그인
              </Link>
            </div>
          </div>
        </div>
        <p className="mt-10 border-t border-line pt-6 text-xs text-muted">
          © {new Date().getFullYear()} Good Auto Systems. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
