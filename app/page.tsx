import Link from "next/link";
import { prisma } from "@/lib/prisma";
import HeroVideo from "@/components/hero-video";
import ProductCard from "@/components/product-card";

const FEATURES = [
  {
    title: "업무 자동화 프로그램",
    description:
      "클릭·입력·데이터 수집 같은 반복 PC 업무를 자동으로 처리하는 데스크톱 프로그램을 제공합니다.",
  },
  {
    title: "AI 업무 자동화",
    description:
      "문서 분류, 보고서 작성, 데이터 정리까지 AI가 대신합니다. 기업 맞춤형 자동화 워크플로를 구축해 드립니다.",
  },
  {
    title: "안정적인 운영 지원",
    description:
      "도입 후에도 전담 매니저가 운영을 지원합니다. 계정 하나로 웹과 프로그램을 모두 이용하세요.",
  },
];

export default async function HomePage() {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    orderBy: { price: "asc" },
  });

  return (
    <>
      {/* 히어로 — 회사/제품 소개 영상 (현재 더미 영상) */}
      <section className="relative flex min-h-[80vh] items-center">
        <HeroVideo />
        <div className="relative mx-auto max-w-6xl px-4 py-24">
          <p className="mb-4 font-medium text-accent-2">Good Auto Systems</p>
          <h1 className="max-w-3xl text-4xl font-bold leading-tight md:text-6xl">
            반복되는 업무는
            <br />
            <span className="text-accent">자동화</span>에 맡기세요
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted">
            굿오토시스템즈는 업무 자동화 프로그램과 AI 자동화 솔루션으로
            당신의 시간을 되돌려 드립니다.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              href="/products"
              className="rounded-lg bg-accent px-6 py-3 font-medium text-white transition hover:bg-accent/80"
            >
              상품 보러가기
            </Link>
            <Link
              href="/services"
              className="rounded-lg border border-line bg-surface/60 px-6 py-3 font-medium transition hover:border-accent/60"
            >
              서비스 알아보기
            </Link>
          </div>
        </div>
      </section>

      {/* 회사 소개 */}
      <section className="mx-auto max-w-6xl px-4 py-24">
        <p className="font-medium text-accent-2">WHY GOOD AUTO SYSTEMS</p>
        <h2 className="mt-2 text-3xl font-bold">
          일은 시스템이, 성과는 당신이
        </h2>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl border border-line bg-surface p-8"
            >
              <h3 className="text-lg font-bold">{feature.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 상품 하이라이트 */}
      <section className="border-t border-line bg-surface/40">
        <div className="mx-auto max-w-6xl px-4 py-24">
          <div className="flex items-end justify-between">
            <div>
              <p className="font-medium text-accent-2">PRODUCTS</p>
              <h2 className="mt-2 text-3xl font-bold">상품 소개</h2>
            </div>
            <Link href="/products" className="text-sm text-accent hover:underline">
              전체 보기 →
            </Link>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 py-24 text-center">
        <h2 className="text-3xl font-bold">지금 바로 시작하세요</h2>
        <p className="mx-auto mt-4 max-w-xl text-muted">
          회원가입 후 상품을 구매하면 웹 계정으로 프로그램에 바로 로그인할 수 있습니다.
        </p>
        <Link
          href="/register"
          className="mt-8 inline-block rounded-lg bg-accent px-8 py-3 font-medium text-white transition hover:bg-accent/80"
        >
          무료 회원가입
        </Link>
      </section>
    </>
  );
}
