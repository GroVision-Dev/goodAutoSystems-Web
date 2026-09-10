import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import ProductCard from "@/components/product-card";

export const metadata: Metadata = { title: "상품소개" };

export default async function ProductsPage() {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    orderBy: { price: "asc" },
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 md:py-16">
      <p className="text-sm font-medium text-accent-2 md:text-base">PRODUCTS</p>
      <h1 className="mt-2 text-2xl font-bold sm:text-3xl">상품소개</h1>
      <p className="mt-3 text-sm text-muted md:text-base">
        업무 자동화 프로그램과 AI 자동화 서비스를 만나보세요.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 md:mt-12 md:gap-6 lg:grid-cols-3">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}
