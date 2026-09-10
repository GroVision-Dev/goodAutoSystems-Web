import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import PortOneCheckout from "@/components/portone-checkout";
import { PRODUCT_CONTENT } from "@/lib/product-content";
import { PRICE_NOTE, RECEIPT_NOTE } from "@/lib/site-config";

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

  const refundPolicy =
    PRODUCT_CONTENT[product.slug]?.notice.find((row) =>
      row.label.startsWith("청약철회"),
    )?.value ??
    (product.category === "PROGRAM"
      ? "다운로드 또는 프로그램 로그인 이전, 결제일로부터 7일 이내 전액 환불. 이후에는 청약철회 제한"
      : "업무 진단 착수 전 전액 환불. 착수 후에는 진행 단계에 따라 잔여 금액 환불");

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 md:py-16">
      <h1 className="text-2xl font-bold">결제하기</h1>

      <div className="mt-6 rounded-2xl border border-line bg-surface p-5 md:mt-8 md:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="font-bold">{product.name}</p>
            <p className="mt-1 text-sm text-muted">{product.summary}</p>
          </div>
          <div className="shrink-0 border-t border-line pt-3 sm:border-0 sm:pt-0 sm:text-right">
            <p className="text-xl font-bold">
              {product.price.toLocaleString()}
              <span className="ml-1 text-sm font-normal text-muted">원</span>
            </p>
            <p className="mt-0.5 text-xs text-muted">{PRICE_NOTE}</p>
          </div>
        </div>
      </div>

      {/* 결제 전 청약철회·환불 조건 고지 (전자상거래법 제13조) */}
      <div className="mt-4 rounded-2xl border border-line bg-surface p-5 text-sm md:p-6">
        <p className="font-bold">결제 전 확인 사항</p>
        <dl className="mt-3 flex flex-col gap-3 break-keep text-muted sm:gap-2">
          <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
            <dt className="w-24 shrink-0 text-xs text-muted/80 sm:text-sm sm:text-muted">제공 방식</dt>
            <dd>
              {product.category === "PROGRAM"
                ? "결제 즉시 마이페이지에서 설치 파일 다운로드"
                : "결제 후 영업일 1일 내 담당자 연락 · 일정 협의 후 착수"}
            </dd>
          </div>
          <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
            <dt className="w-24 shrink-0 text-xs text-muted/80 sm:text-sm sm:text-muted">청약철회·환불</dt>
            <dd>{refundPolicy}</dd>
          </div>
          <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
            <dt className="w-24 shrink-0 text-xs text-muted/80 sm:text-sm sm:text-muted">증빙</dt>
            <dd>{RECEIPT_NOTE}</dd>
          </div>
        </dl>
        <p className="mt-4 text-xs leading-relaxed text-muted">
          결제를 진행하면 위 내용과{" "}
          <Link href="/terms" className="underline hover:text-foreground">
            이용약관
          </Link>
          의 청약철회 및 환불 조항을 확인하고 동의한 것으로 간주됩니다.
        </p>
      </div>

      <div className="mt-6">
        <PortOneCheckout slug={product.slug} />
      </div>
    </div>
  );
}
