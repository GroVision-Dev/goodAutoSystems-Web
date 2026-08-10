import Link from "next/link";
import type { Product } from "@prisma/client";

/** 상품별 강조 지표 (랜딩 쇼케이스용) */
const HIGHLIGHTS: Record<string, string[]> = {
  "goodauto-pro": [
    "코딩 없이 자동화 시나리오 구성",
    "스케줄러로 24시간 무인 실행",
    "엑셀·CSV 데이터 연동",
  ],
  "ai-automation-starter": [
    "업무 프로세스 진단 1회 포함",
    "문서 분류·요약 자동화 구축",
    "1개월 운영 지원",
  ],
  "ai-automation-enterprise": [
    "최대 5개 부서 맞춤 구축",
    "ERP·그룹웨어 연동",
    "전담 매니저 · 3개월 운영 지원",
  ],
};

const CATEGORY_LABEL: Record<string, string> = {
  PROGRAM: "데스크톱 프로그램",
  AI_SERVICE: "AI 자동화 서비스",
};

const CARD_GRADIENT: Record<string, string> = {
  PROGRAM: "from-accent/15 via-surface to-surface",
  AI_SERVICE: "from-accent-2/10 via-surface to-surface",
};

export default function ProductShowcase({ products }: { products: Product[] }) {
  return (
    <div className="mt-14 flex flex-col gap-6">
      {products.map((product, index) => (
        <div
          key={product.id}
          className={`grid gap-8 rounded-2xl border border-line bg-gradient-to-br p-8 md:grid-cols-[1fr_auto] md:items-center md:p-10 ${
            CARD_GRADIENT[product.category]
          }`}
        >
          <div>
            <p className="text-xs font-medium tracking-widest text-muted">
              {String(index + 1).padStart(2, "0")}-PRODUCT ·{" "}
              {CATEGORY_LABEL[product.category]}
            </p>
            <h3 className="mt-3 text-2xl font-bold md:text-3xl">
              {product.name}
            </h3>
            <p className="mt-3 max-w-xl text-muted">{product.summary}</p>
            <ul className="mt-6 flex flex-col gap-2">
              {(HIGHLIGHTS[product.slug] ?? []).map((item) => (
                <li key={item} className="flex items-center gap-2.5 text-sm">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs text-accent">
                    ✓
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col items-start gap-4 md:items-end">
            <p className="text-3xl font-bold">
              {product.price.toLocaleString()}
              <span className="ml-1 text-base font-normal text-muted">원</span>
            </p>
            <Link
              href={`/products/${product.slug}`}
              className="rounded-lg bg-accent px-6 py-3 text-sm font-medium text-white transition hover:bg-accent/80"
            >
              자세히 보기 →
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}
