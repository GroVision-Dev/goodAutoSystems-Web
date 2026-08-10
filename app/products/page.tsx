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
    <div className="mx-auto max-w-6xl px-4 py-16">
      <p className="font-medium text-accent-2">PRODUCTS</p>
      <h1 className="mt-2 text-3xl font-bold">상품소개</h1>
      <p className="mt-3 text-muted">
        업무 자동화 프로그램과 AI 자동화 서비스를 만나보세요.
      </p>
      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}
