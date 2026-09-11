import Link from "next/link";
import type { Product } from "@prisma/client";
import { PRICE_NOTE } from "@/lib/site-config";
import { billingNote, pricePrefix } from "@/lib/product-pricing";

const CATEGORY_LABEL: Record<string, string> = {
  PROGRAM: "프로그램",
  AI_SERVICE: "AI 자동화",
};

/** 상품별 썸네일 (실행 화면) */
const PRODUCT_THUMB: Record<string, string> = {
  "goodauto-pro": "/images/goodauto-pro-ui.svg",
  "ai-automation-starter": "/images/ai-docs-dashboard.svg",
  "ai-automation-enterprise": "/images/ai-report-dashboard.svg",
};

export default function ProductCard({ product }: { product: Product }) {
  const thumb = PRODUCT_THUMB[product.slug];

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-surface transition hover:border-accent/60 hover:bg-surface-2"
    >
      {thumb && (
        <div className="overflow-hidden border-b border-line">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumb}
            alt={`${product.name} 실행 화면`}
            className="aspect-[1200/760] w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        </div>
      )}
      <div className="flex flex-1 flex-col p-5 md:p-6">
        <span
          className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${
            product.category === "PROGRAM"
              ? "bg-accent/15 text-accent"
              : "bg-accent-2/15 text-accent-2"
          }`}
        >
          {CATEGORY_LABEL[product.category]}
        </span>
        <h3 className="mt-4 text-lg font-bold group-hover:text-accent">
          {product.name}
        </h3>
        <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">
          {product.summary}
        </p>
        <p className="mt-6 text-xl font-bold">
          {pricePrefix(product) && (
            <span className="mr-1 text-sm font-normal text-muted">월</span>
          )}
          {product.price.toLocaleString()}
          <span className="ml-1 text-sm font-normal text-muted">원</span>
        </p>
        <p className="mt-1 text-xs text-muted">
          {PRICE_NOTE} · {billingNote(product)}
        </p>
      </div>
    </Link>
  );
}
