import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

const CATEGORY_LABEL: Record<string, string> = {
  PROGRAM: "프로그램",
  AI_SERVICE: "AI 자동화",
};

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await prisma.product.findUnique({ where: { slug } });
  if (!product || !product.isActive) notFound();

  const session = await auth();
  const alreadyPurchased = session
    ? (await prisma.order.count({
        where: {
          userId: session.user.id,
          productId: product.id,
          status: "PAID",
        },
      })) > 0
    : false;

  const checkoutHref = session
    ? `/checkout/${product.slug}`
    : `/login?callbackUrl=/checkout/${product.slug}`;

  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <span
        className={`rounded-full px-3 py-1 text-xs font-medium ${
          product.category === "PROGRAM"
            ? "bg-accent/15 text-accent"
            : "bg-accent-2/15 text-accent-2"
        }`}
      >
        {CATEGORY_LABEL[product.category]}
      </span>
      <h1 className="mt-4 text-3xl font-bold">{product.name}</h1>
      <p className="mt-3 text-lg text-muted">{product.summary}</p>

      <div className="mt-10 grid gap-8 md:grid-cols-[1fr_280px]">
        <div className="rounded-2xl border border-line bg-surface p-8">
          <h2 className="text-lg font-bold">상품 상세</h2>
          <div className="mt-4 whitespace-pre-line text-sm leading-relaxed text-muted">
            {product.description}
          </div>
        </div>

        <div className="h-fit rounded-2xl border border-line bg-surface p-6">
          <p className="text-sm text-muted">판매가</p>
          <p className="mt-1 text-3xl font-bold">
            {product.price.toLocaleString()}
            <span className="ml-1 text-base font-normal text-muted">원</span>
          </p>
          {alreadyPurchased ? (
            <Link
              href="/mypage"
              className="mt-6 block rounded-lg border border-accent py-3 text-center font-medium text-accent transition hover:bg-accent/10"
            >
              구매 완료 · 마이페이지
            </Link>
          ) : (
            <Link
              href={checkoutHref}
              className="mt-6 block rounded-lg bg-accent py-3 text-center font-medium text-white transition hover:bg-accent/80"
            >
              구매하기
            </Link>
          )}
          {product.category === "PROGRAM" && (
            <p className="mt-4 text-xs leading-relaxed text-muted">
              구매 후 마이페이지에서 설치 파일을 다운로드하고, 웹 계정으로
              프로그램에 로그인해 사용합니다.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
