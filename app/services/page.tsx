import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "서비스" };

const STEPS = [
  {
    step: "01",
    title: "업무 프로세스 진단",
    description:
      "현재 업무 흐름을 분석하여 자동화 효과가 큰 구간을 찾아냅니다.",
  },
  {
    step: "02",
    title: "자동화 설계 및 구축",
    description:
      "AI 워크플로와 자동화 프로그램을 조합해 맞춤형 시스템을 구축합니다.",
  },
  {
    step: "03",
    title: "운영 및 지원",
    description:
      "전담 매니저가 도입 이후 운영을 지원하고 지속적으로 개선합니다.",
  },
];

const USE_CASES = [
  {
    title: "문서 자동 분류·요약",
    description:
      "메일과 문서를 AI가 자동으로 분류하고 핵심만 요약해 전달합니다.",
  },
  {
    title: "보고서 자동 작성",
    description:
      "데이터를 수집·정리하여 정기 보고서를 자동으로 생성합니다.",
  },
  {
    title: "반복 입력 업무 자동화",
    description:
      "여러 시스템에 걸친 반복 입력·이관 작업을 프로그램이 대신 수행합니다.",
  },
  {
    title: "사내 시스템 연동",
    description:
      "ERP·그룹웨어 등 기존 시스템과 연동하여 업무 흐름 전체를 자동화합니다.",
  },
];

export default function ServicesPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <p className="font-medium text-accent-2">SERVICES</p>
      <h1 className="mt-2 text-3xl font-bold">AI 업무 자동화 서비스</h1>
      <p className="mt-3 max-w-2xl text-muted">
        Optix는 진단부터 구축, 운영까지 업무 자동화의 전 과정을
        함께합니다.
      </p>

      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {STEPS.map((item) => (
          <div key={item.step} className="rounded-2xl border border-line bg-surface p-8">
            <p className="text-sm font-bold text-accent">{item.step}</p>
            <h3 className="mt-2 text-lg font-bold">{item.title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              {item.description}
            </p>
          </div>
        ))}
      </div>

      {/* 자동화 파이프라인 */}
      <figure className="mt-16">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/workflow-diagram.svg"
          alt="데이터 수집부터 AI 처리, 시스템 입력, 보고까지 이어지는 업무 자동화 파이프라인"
          className="w-full rounded-2xl border border-line"
        />
        <figcaption className="mt-3 text-center text-xs text-muted">
          구축되는 자동화 파이프라인 — 수집부터 보고까지 사람 손을 거치지 않습니다
        </figcaption>
      </figure>

      {/* 실제 화면 */}
      <h2 className="mt-20 text-2xl font-bold">실제 구축 화면</h2>
      <p className="mt-3 max-w-2xl text-muted">
        도입 기업에 제공되는 자동화 워크스페이스 화면입니다. 처리 현황과 성과를
        한눈에 확인할 수 있습니다.
      </p>
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <figure>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/ai-docs-dashboard.svg"
            alt="AI 문서 자동 분류·요약 대시보드"
            className="w-full rounded-2xl border border-line transition hover:border-accent/50"
          />
          <figcaption className="mt-3 text-center text-xs text-muted">
            AI 문서 자동 분류·요약 대시보드
          </figcaption>
        </figure>
        <figure>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/ai-report-dashboard.svg"
            alt="경영 보고서 자동 생성 대시보드"
            className="w-full rounded-2xl border border-line transition hover:border-accent/50"
          />
          <figcaption className="mt-3 text-center text-xs text-muted">
            경영 보고서 자동 생성 대시보드
          </figcaption>
        </figure>
      </div>

      <h2 className="mt-20 text-2xl font-bold">활용 사례</h2>
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        {USE_CASES.map((item) => (
          <div key={item.title} className="rounded-2xl border border-line bg-surface p-8">
            <h3 className="text-lg font-bold">{item.title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              {item.description}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-20 rounded-2xl border border-line bg-surface-2 p-10 text-center">
        <h2 className="text-2xl font-bold">우리 회사에 맞는 자동화가 궁금하다면</h2>
        <p className="mt-3 text-muted">
          AI 자동화 상품을 확인하고 바로 도입해 보세요.
        </p>
        <Link
          href="/products"
          className="mt-6 inline-block rounded-lg bg-accent px-8 py-3 font-medium text-white transition hover:bg-accent/80"
        >
          상품 보러가기
        </Link>
      </div>
    </div>
  );
}
