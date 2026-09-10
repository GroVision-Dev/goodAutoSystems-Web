import type { Metadata } from "next";
import { SITE_INFO, TAX_NOTICE } from "@/lib/site-config";

export const metadata: Metadata = { title: "회사소개" };

const VALUES = [
  {
    title: "실용",
    description: "화려한 기술보다 실제로 시간을 줄여주는 자동화를 만듭니다.",
  },
  {
    title: "신뢰",
    description: "도입 이후에도 책임지고 운영을 지원합니다.",
  },
  {
    title: "혁신",
    description: "AI 기술을 가장 빠르게 실무에 적용합니다.",
  },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 md:py-16">
      <p className="text-sm font-medium text-accent-2 md:text-base">ABOUT US</p>
      <h1 className="mt-2 text-2xl font-bold sm:text-3xl">회사소개</h1>

      <div className="mt-8 rounded-2xl border border-line bg-surface p-6 md:mt-12 md:p-10">
        <h2 className="break-keep text-xl font-bold leading-relaxed md:text-2xl">
          &ldquo;모든 반복 업무를 자동화하여
          <br className="hidden sm:block" />{" "}
          사람은 더 가치 있는 일에 집중하게 한다&rdquo;
        </h2>
        <p className="mt-5 max-w-3xl text-sm leading-relaxed text-muted md:mt-6 md:text-base">
          Optix는 업무 자동화 전문 기업입니다.
          데스크톱 자동화 프로그램과 AI 기반 업무 자동화 솔루션을 통해
          기업과 개인이 반복 업무에서 벗어나 본질적인 일에 집중할 수 있도록
          돕습니다.
        </p>
      </div>

      <div className="mt-6 grid gap-4 md:mt-8 md:grid-cols-3 md:gap-6">
        {VALUES.map((value) => (
          <div key={value.title} className="rounded-2xl border border-line bg-surface p-6 md:p-8">
            <h3 className="text-lg font-bold text-accent">{value.title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              {value.description}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-line bg-surface p-6 md:mt-8 md:p-10">
        <h2 className="text-lg font-bold">회사 정보</h2>
        <dl className="mt-6 grid gap-4 break-keep text-sm md:grid-cols-2">
          <div className="flex gap-4">
            <dt className="w-24 shrink-0 text-muted">상호</dt>
            <dd>{SITE_INFO.companyName}</dd>
          </div>
          <div className="flex gap-4">
            <dt className="w-24 shrink-0 text-muted">대표</dt>
            <dd>{SITE_INFO.ceo}</dd>
          </div>
          <div className="flex gap-4">
            <dt className="w-24 shrink-0 text-muted">사업자번호</dt>
            <dd>
              {SITE_INFO.businessNumber}
              {SITE_INFO.mailOrderNumber &&
                ` · 통신판매업신고 ${SITE_INFO.mailOrderNumber}`}
            </dd>
          </div>
          <div className="flex gap-4">
            <dt className="w-24 shrink-0 text-muted">과세유형</dt>
            <dd>{SITE_INFO.taxType}</dd>
          </div>
          <div className="flex gap-4">
            <dt className="w-24 shrink-0 text-muted">개업일</dt>
            <dd>{SITE_INFO.openedAt.replace(/-/g, ".")}</dd>
          </div>
          <div className="flex gap-4">
            <dt className="w-24 shrink-0 text-muted">사업 분야</dt>
            <dd>업무 자동화 프로그램 개발, AI 자동화 솔루션</dd>
          </div>
          <div className="flex gap-4 md:col-span-2">
            <dt className="w-24 shrink-0 text-muted">업태 · 종목</dt>
            <dd>
              <ul className="space-y-0.5">
                {SITE_INFO.businessTypes.map((type) => (
                  <li key={type.item}>
                    {type.category} · {type.item}
                  </li>
                ))}
              </ul>
            </dd>
          </div>
          <div className="flex gap-4 md:col-span-2">
            <dt className="w-24 shrink-0 text-muted">사업장 소재지</dt>
            <dd>{SITE_INFO.address}</dd>
          </div>
          <div className="flex gap-4">
            <dt className="w-24 shrink-0 text-muted">이메일</dt>
            <dd>{SITE_INFO.email}</dd>
          </div>
          <div className="flex gap-4">
            <dt className="w-24 shrink-0 text-muted">고객지원</dt>
            <dd>
              {SITE_INFO.supportHours}
              {SITE_INFO.phone && ` · ${SITE_INFO.phone}`}
            </dd>
          </div>
        </dl>
        <p className="mt-6 break-keep text-xs leading-relaxed text-muted">{TAX_NOTICE}</p>
      </div>
    </div>
  );
}
