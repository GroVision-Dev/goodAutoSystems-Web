import type { Metadata } from "next";

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
    <div className="mx-auto max-w-6xl px-4 py-16">
      <p className="font-medium text-accent-2">ABOUT US</p>
      <h1 className="mt-2 text-3xl font-bold">회사소개</h1>

      <div className="mt-12 rounded-2xl border border-line bg-surface p-10">
        <h2 className="text-2xl font-bold leading-relaxed">
          &ldquo;모든 반복 업무를 자동화하여
          <br />
          사람은 더 가치 있는 일에 집중하게 한다&rdquo;
        </h2>
        <p className="mt-6 max-w-3xl leading-relaxed text-muted">
          굿오토시스템즈(Good Auto Systems)는 업무 자동화 전문 기업입니다.
          데스크톱 자동화 프로그램과 AI 기반 업무 자동화 솔루션을 통해
          기업과 개인이 반복 업무에서 벗어나 본질적인 일에 집중할 수 있도록
          돕습니다.
        </p>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-3">
        {VALUES.map((value) => (
          <div key={value.title} className="rounded-2xl border border-line bg-surface p-8">
            <h3 className="text-lg font-bold text-accent">{value.title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              {value.description}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-2xl border border-line bg-surface p-10">
        <h2 className="text-lg font-bold">회사 정보</h2>
        <dl className="mt-6 grid gap-4 text-sm md:grid-cols-2">
          <div className="flex gap-4">
            <dt className="w-24 shrink-0 text-muted">회사명</dt>
            <dd>굿오토시스템즈 (Good Auto Systems)</dd>
          </div>
          <div className="flex gap-4">
            <dt className="w-24 shrink-0 text-muted">사업 분야</dt>
            <dd>업무 자동화 프로그램 개발, AI 자동화 솔루션</dd>
          </div>
          <div className="flex gap-4">
            <dt className="w-24 shrink-0 text-muted">이메일</dt>
            <dd>contact@goodautosystems.com</dd>
          </div>
          <div className="flex gap-4">
            <dt className="w-24 shrink-0 text-muted">고객지원</dt>
            <dd>평일 09:00 - 18:00</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
