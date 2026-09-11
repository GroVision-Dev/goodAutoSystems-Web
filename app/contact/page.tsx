import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { SITE_INFO } from "@/lib/site-config";
import InquiryForm from "@/components/inquiry-form";
import { loadInquiryProducts } from "@/components/contact-section";

export const metadata: Metadata = { title: "도입 문의" };

/** 상품 페이지 등에서 관심 상품을 미리 고른 채로 여는 문의 페이지 */
export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string }>;
}) {
  const { product: productSlug } = await searchParams;
  const [products, product] = await Promise.all([
    loadInquiryProducts(),
    productSlug
      ? prisma.product.findUnique({ where: { slug: productSlug }, select: { slug: true, name: true } })
      : Promise.resolve(null),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 md:py-16">
      <p className="text-sm font-medium text-accent-2">CONTACT</p>
      <h1 className="mt-2 text-2xl font-bold sm:text-3xl">도입 문의</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted md:text-base">
        {product ? (
          <>
            <Link href={`/products/${product.slug}`} className="text-accent hover:underline">
              {product.name}
            </Link>
            에 대해 궁금한 점을 남겨주세요.{" "}
          </>
        ) : null}
        업무 내용을 간단히 적어주시면 적용 가능 여부와 예상 절감 효과를 무료로 진단해 드립니다.
        영업일 기준 1일 내에 연락드립니다.
      </p>

      <div className="mt-8 rounded-2xl border border-line bg-surface p-5 sm:p-8">
        <InquiryForm products={products} defaultProductSlug={product?.slug} />
      </div>

      <p className="mt-6 text-xs text-muted">
        전화 {SITE_INFO.phone} · {SITE_INFO.email} · {SITE_INFO.supportHours}
      </p>
    </div>
  );
}
