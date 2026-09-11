import Link from "next/link";
import type { Product } from "@prisma/client";
import { billingNote, pricePrefix } from "@/lib/product-pricing";

/** 상품별 강조 지표 (랜딩 쇼케이스용) */
const HIGHLIGHTS: Record<string, string[]> = {
  "goodauto-pro": [
    "코딩 없이 자동화 시나리오 구성",
    "스케줄러로 24시간 무인 실행",
    "엑셀·CSV 데이터 연동",
  ],
  "ai-automation-starter": [
    "업무 프로세스 진단 포함",
    "문서 분류·요약 자동화 구축",
    "월 단위 계약 · 운영 지원 포함",
  ],
  "ai-automation-enterprise": [
    "최대 5개 부서 맞춤 구축",
    "ERP·그룹웨어 연동",
    "전담 매니저 · 1~3개월 용역",
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
    <div className="mt-10 flex flex-col gap-4 md:mt-14 md:gap-6">
      {products.map((product, index) => (
        <div
          key={product.id}
          className={`grid gap-6 rounded-2xl border border-line bg-gradient-to-br p-6 md:grid-cols-[1fr_auto] md:items-center md:gap-8 md:p-10 ${
            CARD_GRADIENT[product.category]
          }`}
        >
          <div>
            <p className="text-xs font-medium tracking-widest text-muted">
              {String(index + 1).padStart(2, "0")}-PRODUCT ·{" "}
              {CATEGORY_LABEL[product.category]}
            </p>
            <h3 className="mt-3 text-xl font-bold sm:text-2xl md:text-3xl">
              {product.name}
            </h3>
            <p className="mt-3 max-w-xl text-sm text-muted md:text-base">{product.summary}</p>
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
          <div className="flex flex-row items-center justify-between gap-4 border-t border-line pt-5 md:flex-col md:items-end md:border-0 md:pt-0">
            <div className="md:text-right">
              <p className="text-2xl font-bold md:text-3xl">
                {pricePrefix(product) && (
                  <span className="mr-1 text-base font-normal text-muted">월</span>
                )}
                {product.price.toLocaleString()}
                <span className="ml-1 text-base font-normal text-muted">원</span>
              </p>
              <p className="mt-1 text-xs text-muted">{billingNote(product)}</p>
            </div>
            <Link
              href={`/products/${product.slug}`}
              className="shrink-0 rounded-lg bg-accent px-5 py-3 text-sm font-medium text-white transition hover:bg-accent/80 md:px-6"
            >
              자세히 보기 →
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}
