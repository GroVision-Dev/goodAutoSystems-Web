import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="flex flex-col justify-between gap-10 md:flex-row">
          <div className="max-w-sm">
            <p className="flex items-center gap-2 text-lg font-bold">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-sm text-white">
                G
              </span>
              굿오토시스템즈
            </p>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              업무 자동화 프로그램과 AI 자동화 솔루션으로
              <br />
              반복 업무 없는 일터를 만듭니다.
            </p>
          </div>
          <div className="flex gap-16 text-sm">
            <div className="flex flex-col gap-2.5">
              <p className="font-medium">서비스</p>
              <Link href="/products" className="text-muted hover:text-foreground">
                상품소개
              </Link>
              <Link href="/services" className="text-muted hover:text-foreground">
                AI 자동화 서비스
              </Link>
              <Link href="/about" className="text-muted hover:text-foreground">
                회사소개
              </Link>
            </div>
            <div className="flex flex-col gap-2.5">
              <p className="font-medium">고객지원</p>
              <Link href="/mypage" className="text-muted hover:text-foreground">
                마이페이지
              </Link>
              <a
                href="mailto:contact@goodautosystems.com"
                className="text-muted hover:text-foreground"
              >
                도입 문의
              </a>
              <Link href="/terms" className="text-muted hover:text-foreground">
                이용약관
              </Link>
              <Link href="/privacy" className="text-muted hover:text-foreground">
                개인정보처리방침
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-line pt-6 text-xs leading-relaxed text-muted">
          <p>
            상호 : 굿오토시스템즈 · 대표 : 강석인 · 사업자등록번호 :
            250-12-03264
          </p>
          <p className="mt-1">
            주소 : 전북특별자치도 전주시 완산구 세내로 303, 102동 602호
            (효자동3가, 서부신시가지 코아루해피트리)
          </p>
          <p className="mt-1">
            이메일 : contact@goodautosystems.com · 고객지원 : 평일 09:00 -
            18:00
          </p>
          <p className="mt-4">
            © {new Date().getFullYear()} Good Auto Systems. All rights
            reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
