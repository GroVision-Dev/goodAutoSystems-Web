import Link from "next/link";
import type { Product } from "@prisma/client";

const CATEGORY_LABEL: Record<string, string> = {
  PROGRAM: "프로그램",
  AI_SERVICE: "AI 자동화",
};

export default function ProductCard({ product }: { product: Product }) {
  return (
    <Link
      href={`/products/${product.slug}`}
      className="group flex flex-col rounded-2xl border border-line bg-surface p-6 transition hover:border-accent/60 hover:bg-surface-2"
    >
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
        {product.price.toLocaleString()}
        <span className="ml-1 text-sm font-normal text-muted">원</span>
      </p>
    </Link>
  );
}
