import Image from "next/image";
import Link from "next/link";
import { SITE_INFO, TAX_NOTICE } from "@/lib/site-config";

export default function SiteFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-10 md:py-12">
        <div className="flex flex-col justify-between gap-8 md:flex-row md:gap-10">
          <div className="max-w-sm">
            <Image
              src="/images/logo-white.png"
              alt="Optix"
              width={112}
              height={32}
              className="h-8 w-auto"
            />
            <p className="mt-3 text-sm leading-relaxed text-muted">
              업무 자동화 프로그램과 AI 자동화 솔루션으로
              <br />
              반복 업무 없는 일터를 만듭니다.
            </p>
          </div>
          <div className="flex gap-10 text-sm sm:gap-16">
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

        <div className="mt-8 break-keep border-t border-line pt-6 text-xs leading-relaxed text-muted md:mt-10">
          <p>
            상호 : {SITE_INFO.companyName} · 대표 : {SITE_INFO.ceo} ·
            사업자등록번호 : {SITE_INFO.businessNumber} ({SITE_INFO.taxType})
            {SITE_INFO.mailOrderNumber && (
              <> · 통신판매업신고 : {SITE_INFO.mailOrderNumber}</>
            )}
          </p>
          <p className="mt-1">사업장 소재지 : {SITE_INFO.address}</p>
          <p className="mt-1">
            이메일 : {SITE_INFO.email}
            {SITE_INFO.phone && <> · 전화 : {SITE_INFO.phone}</>} · 고객지원 :{" "}
            {SITE_INFO.supportHours}
          </p>
          <p className="mt-1">
            개인정보보호책임자 : {SITE_INFO.privacyOfficer} · 호스팅 :{" "}
            {SITE_INFO.hostingProvider}
          </p>
          <p className="mt-1">
            상품 가격은 부가세(VAT) 포함 금액이며, 청약철회·환불 규정은{" "}
            <Link href="/terms" className="underline hover:text-foreground">
              이용약관
            </Link>
            을 따릅니다.
          </p>
          <p className="mt-1">{TAX_NOTICE}</p>
          <p className="mt-4">
            © {new Date().getFullYear()} Optix. All rights
            reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
