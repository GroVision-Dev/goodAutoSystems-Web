import Link from "next/link";
import { prisma } from "@/lib/prisma";
import HeroVideo from "@/components/hero-video";
import ProductShowcase from "@/components/product-showcase";
import ContactSection from "@/components/contact-section";

const PAIN_POINTS = [
  {
    title: "매일 반복되는 단순 업무에 시간을 뺏기고 있다",
    description:
      "복사·붙여넣기, 시스템 간 데이터 이관, 정산 파일 정리 같은 일이 하루 업무의 절반을 차지합니다.",
  },
  {
    title: "사람이 하다 보니 실수가 계속 생긴다",
    description:
      "수작업 입력 오류 하나가 정산 차이, 재고 불일치, 고객 클레임으로 이어집니다.",
  },
  {
    title: "야간·주말에도 처리해야 할 일이 쌓인다",
    description:
      "주문 수집, 리포트 생성처럼 시간이 정해진 업무 때문에 퇴근 후에도 PC 앞을 떠나지 못합니다.",
  },
  {
    title: "자동화를 하고 싶어도 어디서 시작할지 막막하다",
    description:
      "개발자를 채용하기엔 부담스럽고, 외주를 맡기자니 우리 업무를 잘 몰라 결과물이 걱정됩니다.",
  },
];

const PROCESS_STEPS = [
  {
    step: "01",
    title: "업무 진단",
    duration: "1주차",
    description:
      "현재 업무 흐름을 함께 분석하고, 자동화했을 때 효과가 가장 큰 구간부터 우선순위를 정합니다.",
    points: [
      "부서별 반복 업무 인터뷰 및 소요 시간 측정",
      "자동화 가능 구간 식별과 예상 절감 시간 산출",
      "우선순위 로드맵 제안",
    ],
  },
  {
    step: "02",
    title: "구축 및 검증",
    duration: "2~4주차",
    description:
      "자동화 프로그램과 AI 워크플로를 실제 업무 데이터로 검증하며 구축합니다.",
    points: [
      "실데이터 기반 시나리오 구축",
      "담당자와 함께 결과 검수 및 예외 케이스 보완",
      "기존 시스템(ERP·그룹웨어·엑셀) 연동",
    ],
  },
  {
    step: "03",
    title: "운영 및 확산",
    duration: "도입 이후",
    description:
      "전담 매니저가 운영을 지원하고, 성과가 검증된 자동화를 다른 부서로 확산합니다.",
    points: [
      "실행 모니터링·오류 알림 체계 운영",
      "월간 성과 리포트 제공",
      "추가 자동화 과제 발굴",
    ],
  },
];

const METRICS = [
  { value: "70%", label: "반복 문서 업무 시간 절감", note: "도입 기업 평균" },
  { value: "1,200시간+", label: "연간 절감 업무 시간", note: "엔터프라이즈 기준" },
  { value: "24시간", label: "무인 자동 실행", note: "스케줄러 기반" },
  { value: "4주", label: "평균 구축 기간", note: "진단부터 운영까지" },
];

const CASES = [
  {
    industry: "이커머스 · 유통",
    title: "주문·정산 데이터 취합 자동화",
    description:
      "오픈마켓 5개 채널의 주문·정산 데이터를 매일 아침 자동 취합하도록 구축했습니다. 담당자가 매일 2시간씩 하던 작업이 클릭 한 번으로 끝납니다.",
    result: "일 2시간 → 5분",
  },
  {
    industry: "제조",
    title: "발주서 처리·재고 보고 자동화",
    description:
      "거래처별 발주서 양식을 AI가 판독해 ERP에 자동 입력하고, 재고 현황 보고서를 매주 자동 생성합니다.",
    result: "입력 오류 0건 유지",
  },
  {
    industry: "서비스 · 사무",
    title: "월간 보고서 자동 작성",
    description:
      "여러 시스템에 흩어진 실적 데이터를 모아 월간 보고서 초안을 자동 생성합니다. 보고서 작성일이 반나절로 줄었습니다.",
    result: "작성 시간 75% 절감",
  },
];

const FAQS = [
  {
    q: "프로그램은 어떻게 사용하나요?",
    a: "상품 구매 후 마이페이지에서 설치 파일을 다운로드하고, 홈페이지 계정으로 프로그램에 로그인하면 바로 사용할 수 있습니다. 별도의 라이선스 키 입력은 필요 없습니다.",
  },
  {
    q: "우리 회사 업무에도 적용할 수 있을까요?",
    a: "엑셀·웹사이트·사내 시스템을 오가는 반복 업무라면 대부분 자동화할 수 있습니다. 문의를 남겨주시면 업무 내용을 확인한 뒤 적용 가능 여부와 예상 효과를 무료로 안내해 드립니다.",
  },
  {
    q: "AI 자동화 서비스는 어떤 방식으로 진행되나요?",
    a: "업무 진단(1주) → 구축·검증(2~4주) → 운영 지원 순서로 진행됩니다. 스타터는 1개 업무 프로세스, 엔터프라이즈는 최대 5개 부서까지 포함합니다.",
  },
  {
    q: "결제는 어떻게 하나요? 세금계산서 발행이 가능한가요?",
    a: "결제대행사 포트원(PortOne)을 통해 카드로 안전하게 결제됩니다. 당사는 간이과세자로 세금계산서 발행이 불가하며, 카드 매출전표 또는 현금영수증(지출증빙용)으로 증빙하실 수 있습니다.",
  },
  {
    q: "도입 후 문제가 생기면 지원을 받을 수 있나요?",
    a: "네. 프로그램은 무상 업데이트를 제공하며, AI 자동화 서비스는 상품별로 1~3개월의 운영 지원 기간 동안 전담 매니저가 오류 대응과 개선을 지원합니다.",
  },
];

export default async function HomePage() {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    orderBy: { price: "asc" },
  });

  return (
    <>
      {/* 히어로 — 회사/제품 소개 영상 (현재 더미 영상) */}
      <section className="relative flex min-h-[70vh] items-center md:min-h-[88vh]">
        <HeroVideo />
        <div className="relative mx-auto w-full max-w-6xl px-4 py-16 md:py-24">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-surface/60 px-4 py-1.5 text-xs text-muted backdrop-blur sm:text-sm">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent-2" />
            업무 자동화 프로그램 · AI 자동화 구축 전문
          </p>
          <h1 className="max-w-3xl text-3xl font-bold leading-[1.2] sm:text-4xl md:text-6xl">
            사람은 판단에 집중하고,
            <br />
            <span className="bg-gradient-to-r from-accent to-accent-2 bg-clip-text text-transparent">
              반복 업무는 시스템이
            </span>
            &nbsp;합니다
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted md:mt-6 md:text-lg">
            Optix는 데스크톱 자동화 프로그램과 기업 맞춤형 AI 자동화
            구축으로 매일 반복되는 업무를 시스템에 맡기도록 돕습니다.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-4 md:mt-10">
            <Link
              href="/products"
              className="rounded-lg bg-accent px-7 py-3.5 text-center font-medium text-white transition hover:bg-accent/80"
            >
              상품 보러가기
            </Link>
            <a
              href="#contact"
              className="rounded-lg border border-line bg-surface/60 px-7 py-3.5 text-center font-medium backdrop-blur transition hover:border-accent/60"
            >
              도입 문의하기
            </a>
          </div>
          <div className="mt-10 flex flex-wrap gap-x-10 gap-y-2 text-xs text-muted sm:text-sm md:mt-14 md:gap-y-3">
            <span>이커머스 · 제조 · 물류 · 서비스업 현장 적용</span>
            <span className="hidden md:inline text-line">|</span>
            <span>포트원(PortOne) 안전 결제</span>
            <span className="hidden md:inline text-line">|</span>
            <span>도입 후 전담 운영 지원</span>
          </div>
        </div>
      </section>

      {/* 핵심 지표 */}
      <section className="border-y border-line bg-surface/40">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-10 sm:gap-8 md:grid-cols-4 md:py-14">
          {METRICS.map((metric) => (
            <div key={metric.label}>
              <p className="text-2xl font-bold text-foreground sm:text-3xl md:text-4xl">
                {metric.value}
              </p>
              <p className="mt-2 text-sm font-medium">{metric.label}</p>
              <p className="mt-1 text-xs text-muted">{metric.note}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 페인포인트 */}
      <section className="mx-auto max-w-6xl px-4 py-16 md:py-28">
        <p className="text-sm font-medium text-accent-2 md:text-base">WHY AUTOMATION</p>
        <h2 className="mt-3 text-2xl font-bold leading-snug sm:text-3xl md:text-4xl">
          혹시 지금, 이런 하루를
          <br className="md:hidden" /> 보내고 계신가요?
        </h2>
        <div className="mt-10 grid gap-4 md:mt-14 md:grid-cols-2 md:gap-5">
          {PAIN_POINTS.map((item, index) => (
            <div
              key={item.title}
              className="rounded-2xl border border-line bg-surface p-6 transition hover:border-accent/40 md:p-8"
            >
              <p className="text-sm font-bold text-accent">
                {String(index + 1).padStart(2, "0")}
              </p>
              <h3 className="mt-3 text-lg font-bold">{item.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                {item.description}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-8 text-center text-base font-medium text-muted md:mt-10 md:text-lg">
          하나라도 해당된다면, 이미 자동화로 돌려받을 수 있는 시간이 있다는
          뜻입니다.
        </p>
      </section>

      {/* 진행 프로세스 */}
      <section className="border-t border-line bg-surface/40">
        <div className="mx-auto max-w-6xl px-4 py-16 md:py-28">
          <p className="text-sm font-medium text-accent-2 md:text-base">PROCESS</p>
          <h2 className="mt-3 text-2xl font-bold sm:text-3xl md:text-4xl">
            진단부터 운영까지, 이렇게 진행됩니다
          </h2>
          <p className="mt-4 max-w-2xl text-sm text-muted md:text-base">
            담당 개발자가 직접 업무 현장을 파악하고, 실제 데이터로 검증하며
            구축합니다. 만들어 놓고 끝나는 자동화가 아니라 계속 돌아가는
            시스템을 만듭니다.
          </p>
          <div className="mt-10 grid gap-4 md:mt-14 md:gap-6 lg:grid-cols-3">
            {PROCESS_STEPS.map((step) => (
              <div
                key={step.step}
                className="relative rounded-2xl border border-line bg-surface p-6 md:p-8"
              >
                <div className="flex items-center justify-between">
                  <span className="text-3xl font-bold text-accent/60">
                    {step.step}
                  </span>
                  <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
                    {step.duration}
                  </span>
                </div>
                <h3 className="mt-4 text-xl font-bold">{step.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted">
                  {step.description}
                </p>
                <ul className="mt-5 flex flex-col gap-2.5 border-t border-line pt-5">
                  {step.points.map((point) => (
                    <li key={point} className="flex gap-2.5 text-sm text-muted">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent-2" />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 상품 쇼케이스 */}
      <section className="mx-auto max-w-6xl px-4 py-16 md:py-28">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-accent-2 md:text-base">PRODUCTS</p>
            <h2 className="mt-3 text-2xl font-bold sm:text-3xl md:text-4xl">
              업무에 맞는 자동화를 선택하세요
            </h2>
          </div>
          <Link
            href="/products"
            className="hidden shrink-0 text-sm text-accent hover:underline md:block"
          >
            전체 상품 보기 →
          </Link>
        </div>
        <ProductShowcase products={products} />
        <Link
          href="/products"
          className="mt-6 block rounded-lg border border-line py-3 text-center text-sm font-medium text-accent transition hover:border-accent/60 md:hidden"
        >
          전체 상품 보기 →
        </Link>
      </section>

      {/* 도입 사례 */}
      <section className="border-t border-line bg-surface/40">
        <div className="mx-auto max-w-6xl px-4 py-16 md:py-28">
          <p className="text-sm font-medium text-accent-2 md:text-base">USE CASES</p>
          <h2 className="mt-3 text-2xl font-bold sm:text-3xl md:text-4xl">
            현장에서 이렇게 쓰이고 있습니다
          </h2>
          <div className="mt-10 grid gap-4 md:mt-14 md:grid-cols-3 md:gap-6">
            {CASES.map((item) => (
              <div
                key={item.title}
                className="flex flex-col rounded-2xl border border-line bg-surface p-6 md:p-8"
              >
                <p className="text-xs font-medium text-accent-2">
                  {item.industry}
                </p>
                <h3 className="mt-3 text-lg font-bold">{item.title}</h3>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-muted">
                  {item.description}
                </p>
                <p className="mt-6 border-t border-line pt-4 text-sm font-bold text-accent">
                  {item.result}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 py-16 md:py-28">
        <p className="text-center text-sm font-medium text-accent-2 md:text-base">FAQ</p>
        <h2 className="mt-3 text-center text-2xl font-bold sm:text-3xl">자주 묻는 질문</h2>
        <div className="mt-8 flex flex-col gap-3 md:mt-12">
          {FAQS.map((faq) => (
            <details
              key={faq.q}
              className="group rounded-xl border border-line bg-surface open:border-accent/40"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-medium [&::-webkit-details-marker]:hidden md:px-6 md:py-5 md:text-base">
                {faq.q}
                <span className="shrink-0 text-muted transition group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="border-t border-line px-5 py-4 text-sm leading-relaxed text-muted md:px-6 md:py-5">
                {faq.a}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* 문의 */}
      <ContactSection />
    </>
  );
}
