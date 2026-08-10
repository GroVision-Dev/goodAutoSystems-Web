import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import TossCheckout from "@/components/toss-checkout";

export const metadata: Metadata = { title: "결제하기" };

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await auth();
  if (!session) redirect(`/login?callbackUrl=/checkout/${slug}`);

  const product = await prisma.product.findUnique({ where: { slug } });
  if (!product || !product.isActive) notFound();

  const alreadyPaid = await prisma.order.findFirst({
    where: { userId: session.user.id, productId: product.id, status: "PAID" },
  });
  if (alreadyPaid) redirect("/mypage");

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-2xl font-bold">결제하기</h1>

      <div className="mt-8 rounded-2xl border border-line bg-surface p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-bold">{product.name}</p>
            <p className="mt-1 text-sm text-muted">{product.summary}</p>
          </div>
          <p className="text-xl font-bold">
            {product.price.toLocaleString()}
            <span className="ml-1 text-sm font-normal text-muted">원</span>
          </p>
        </div>
      </div>

      <div className="mt-6">
        <TossCheckout slug={product.slug} />
      </div>
    </div>
  );
}
