import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import {
  PRODUCT_CONTENT,
  AI_SERVICE_COMPARISON,
} from "@/lib/product-content";
import ProductCard from "@/components/product-card";
import { SITE_INFO, PROGRAM_VERSION, PRICE_NOTE } from "@/lib/site-config";

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

  const otherProducts = await prisma.product.findMany({
    where: { isActive: true, id: { not: product.id } },
    orderBy: { price: "asc" },
    take: 2,
  });

  const checkoutHref = session
    ? `/checkout/${product.slug}`
    : `/login?callbackUrl=/checkout/${product.slug}`;
  const content = PRODUCT_CONTENT[product.slug];
  const showComparison =
    product.category === "AI_SERVICE" &&
    ["ai-automation-starter", "ai-automation-enterprise"].includes(product.slug);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 pb-28 md:py-16 lg:pb-16">
      {/* 헤더 */}
      <p className="text-sm text-muted">
        <Link href="/products" className="hover:text-foreground">
          상품소개
        </Link>{" "}
        / {product.name}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            product.category === "PROGRAM"
              ? "bg-accent/15 text-accent"
              : "bg-accent-2/15 text-accent-2"
          }`}
        >
          {CATEGORY_LABEL[product.category]}
        </span>
      </div>
      <h1 className="mt-3 text-2xl font-bold sm:text-3xl md:text-4xl">{product.name}</h1>
      <p className="mt-3 max-w-2xl text-base text-muted md:text-lg">{product.summary}</p>

      {/* 핵심 지표 */}
      {content && (
        <div className="mt-8 grid grid-cols-3 gap-2 sm:gap-4 md:max-w-2xl">
          {content.metrics.map((metric) => (
            <div
              key={metric.label}
              className="rounded-xl border border-line bg-surface px-3 py-3 sm:px-5 sm:py-4"
            >
              <p className="text-lg font-bold text-accent sm:text-2xl">{metric.value}</p>
              <p className="mt-1 text-[11px] text-muted sm:text-xs">{metric.label}</p>
              {metric.basis && (
                <p className="mt-1 hidden text-[10px] leading-snug text-muted/70 sm:block">
                  * {metric.basis}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_300px]">
        {/* 본문 */}
        <div className="min-w-0">
          {/* 화면 갤러리 */}
          {content?.gallery.map((image) => (
            <figure key={image.src} className="mb-8">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.src}
                alt={image.alt}
                className="w-full rounded-2xl border border-line"
              />
              <figcaption className="mt-3 text-center text-xs text-muted">
                {image.caption}
              </figcaption>
            </figure>
          ))}

          {/* 주요 기능 */}
          {content && (
            <section className="mt-12">
              <h2 className="text-2xl font-bold">주요 기능</h2>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {content.features.map((feature) => (
                  <div
                    key={feature.title}
                    className="rounded-2xl border border-line bg-surface p-6"
                  >
                    <span className="text-2xl">{feature.icon}</span>
                    <h3 className="mt-3 font-bold">{feature.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted">
                      {feature.description}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 진행 일정 (서비스) */}
          {content?.timeline && (
            <section className="mt-12">
              <h2 className="text-2xl font-bold">진행 일정</h2>
              <div className="mt-6 flex flex-col gap-0">
                {content.timeline.map((step, index) => (
                  <div key={step.period} className="flex gap-5">
                    <div className="flex flex-col items-center">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-bold text-accent">
                        {index + 1}
                      </span>
                      {index < content.timeline!.length - 1 && (
                        <span className="w-px flex-1 bg-line" />
                      )}
                    </div>
                    <div className="pb-8">
                      <p className="text-xs font-medium text-accent-2">
                        {step.period}
                      </p>
                      <h3 className="mt-1 font-bold">{step.title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-muted">
                        {step.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 스펙 / 포함 내역 */}
          {content && (
            <section className="mt-12">
              <h2 className="text-2xl font-bold">{content.specsTitle}</h2>
              <div className="mt-6 overflow-hidden rounded-2xl border border-line">
                <table className="w-full text-left text-sm">
                  <tbody>
                    {product.category === "PROGRAM" && (
                      <tr className="bg-surface">
                        <th className="w-28 px-4 py-3.5 align-top font-medium text-muted sm:w-36 sm:px-5 md:w-44">
                          현재 버전
                        </th>
                        <td className="px-5 py-3.5">
                          v{PROGRAM_VERSION.version} ({PROGRAM_VERSION.releasedAt} 배포)
                        </td>
                      </tr>
                    )}
                    {content.specs.map((row, index) => (
                      <tr
                        key={row.label}
                        className={index % 2 === 0 ? "bg-surface" : "bg-surface-2/50"}
                      >
                        <th className="w-28 px-4 py-3.5 align-top font-medium text-muted sm:w-36 sm:px-5 md:w-44">
                          {row.label}
                        </th>
                        <td className="break-keep px-4 py-3.5 sm:px-5">{row.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* 상세 설명 */}
          <section className="mt-12">
            <h2 className="text-2xl font-bold">상품 상세</h2>
            <div className="mt-6 whitespace-pre-line break-keep rounded-2xl border border-line bg-surface p-5 text-sm leading-relaxed text-muted md:p-8">
              {product.description}
            </div>
          </section>

          {/* 스타터 vs 엔터프라이즈 비교 */}
          {showComparison && (
            <section className="mt-12">
              <h2 className="text-2xl font-bold">어떤 상품이 맞을까요?</h2>
              <div className="mt-6 overflow-x-auto rounded-2xl border border-line">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-line bg-surface-2/50 text-muted">
                      <th className="px-5 py-3.5 font-medium">구분</th>
                      <th
                        className={`px-5 py-3.5 font-bold ${
                          product.slug === "ai-automation-starter"
                            ? "text-accent"
                            : "text-foreground"
                        }`}
                      >
                        스타터
                      </th>
                      <th
                        className={`px-5 py-3.5 font-bold ${
                          product.slug === "ai-automation-enterprise"
                            ? "text-accent"
                            : "text-foreground"
                        }`}
                      >
                        엔터프라이즈
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {AI_SERVICE_COMPARISON.rows.map((row, index) => (
                      <tr
                        key={row.label}
                        className={index % 2 === 0 ? "bg-surface" : "bg-surface-2/50"}
                      >
                        <th className="px-5 py-3.5 font-medium text-muted">
                          {row.label}
                        </th>
                        <td className="px-5 py-3.5">{row.starter}</td>
                        <td className="px-5 py-3.5">{row.enterprise}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* 구매 전 유의사항 */}
          {content && (
            <section className="mt-12">
              <h2 className="text-2xl font-bold">구매 전 확인해 주세요</h2>
              <ul className="mt-6 flex flex-col gap-3 rounded-2xl border border-accent-2/30 bg-accent-2/5 p-6">
                {content.caveats.map((caveat) => (
                  <li key={caveat} className="flex gap-3 text-sm leading-relaxed text-muted">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-2" />
                    {caveat}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* 상품별 FAQ */}
          {content && (
            <section className="mt-12">
              <h2 className="text-2xl font-bold">자주 묻는 질문</h2>
              <div className="mt-6 flex flex-col gap-3">
                {content.faqs.map((faq) => (
                  <details
                    key={faq.q}
                    className="group rounded-xl border border-line bg-surface open:border-accent/40"
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-4 text-sm font-medium [&::-webkit-details-marker]:hidden">
                      {faq.q}
                      <span className="text-muted transition group-open:rotate-45">
                        +
                      </span>
                    </summary>
                    <p className="border-t border-line px-6 py-4 text-sm leading-relaxed text-muted">
                      {faq.a}
                    </p>
                  </details>
                ))}
              </div>
            </section>
          )}

          {/* 상품정보 제공고시 (전자상거래법) */}
          {content && (
            <section className="mt-12">
              <h2 className="text-xl font-bold">상품정보 제공고시</h2>
              <p className="mt-2 text-xs text-muted">
                전자상거래 등에서의 소비자보호에 관한 법률에 따른 상품 정보입니다.
              </p>
              <div className="mt-4 overflow-hidden rounded-2xl border border-line">
                <table className="w-full text-left text-xs">
                  <tbody>
                    {content.notice.map((row, index) => (
                      <tr
                        key={row.label}
                        className={index % 2 === 0 ? "bg-surface" : "bg-surface-2/50"}
                      >
                        <th className="w-28 px-3 py-3 align-top font-medium text-muted sm:w-36 sm:px-4 md:w-44">
                          {row.label}
                        </th>
                        <td className="break-keep px-3 py-3 leading-relaxed sm:px-4">{row.value}</td>
                      </tr>
                    ))}
                    <tr
                      className={
                        content.notice.length % 2 === 0 ? "bg-surface" : "bg-surface-2/50"
                      }
                    >
                      <th className="w-28 px-3 py-3 align-top font-medium text-muted sm:w-36 sm:px-4 md:w-44">
                        판매자 정보
                      </th>
                      <td className="break-keep px-3 py-3 leading-relaxed sm:px-4">
                        {SITE_INFO.companyName} · 대표 {SITE_INFO.ceo} · 사업자등록번호{" "}
                        {SITE_INFO.businessNumber} ({SITE_INFO.taxType})
                        {SITE_INFO.mailOrderNumber &&
                          ` · 통신판매업신고 ${SITE_INFO.mailOrderNumber}`}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>

        {/* 구매 사이드바 (스크롤 고정) */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-line bg-surface p-6">
            <p className="text-sm text-muted">판매가</p>
            <p className="mt-1 text-3xl font-bold">
              {product.price.toLocaleString()}
              <span className="ml-1 text-base font-normal text-muted">원</span>
            </p>
            <p className="mt-1 text-xs text-muted">
              {PRICE_NOTE}
              {product.category === "PROGRAM"
                ? " · 1회 결제 · 영구 사용권"
                : " · 1회 결제 · 현금영수증 발행 가능"}
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
            <a
              href="mailto:contact@goodautosystems.com?subject=%EB%8F%84%EC%9E%85%20%EB%AC%B8%EC%9D%98"
              className="mt-3 block rounded-lg border border-line py-3 text-center text-sm text-muted transition hover:border-accent/60 hover:text-foreground"
            >
              도입 전 문의하기
            </a>

            {product.category === "PROGRAM" ? (
              <ol className="mt-6 flex flex-col gap-3 border-t border-line pt-5 text-xs leading-relaxed text-muted">
                <li className="flex gap-2">
                  <span className="font-bold text-accent">1</span>
                  토스페이먼츠로 안전하게 결제
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-accent">2</span>
                  마이페이지에서 설치 파일 다운로드
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-accent">3</span>
                  홈페이지 계정으로 프로그램 로그인 후 바로 사용
                </li>
              </ol>
            ) : (
              <ol className="mt-6 flex flex-col gap-3 border-t border-line pt-5 text-xs leading-relaxed text-muted">
                <li className="flex gap-2">
                  <span className="font-bold text-accent">1</span>
                  토스페이먼츠로 안전하게 결제
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-accent">2</span>
                  담당 매니저가 영업일 1일 내 연락드려 일정 협의
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-accent">3</span>
                  업무 진단 후 구축 착수
                </li>
              </ol>
            )}
            <p className="mt-5 text-[11px] leading-relaxed text-muted">
              결제 관련 규정은{" "}
              <Link href="/terms" className="underline hover:text-foreground">
                이용약관
              </Link>
              의 청약철회 및 환불 조항을 따릅니다. 당사는 간이과세자로
              세금계산서 발행이 불가하며, 현금영수증(지출증빙용)이 필요하면
              결제 후 문의해 주세요.
            </p>
          </div>
        </div>
      </div>

      {/* 다른 상품 */}
      {otherProducts.length > 0 && (
        <section className="mt-20 border-t border-line pt-12">
          <h2 className="text-2xl font-bold">함께 보면 좋은 상품</h2>
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {otherProducts.map((other) => (
              <ProductCard key={other.id} product={other} />
            ))}
          </div>
        </section>
      )}

      {/* 하단 CTA */}
      <section className="mt-16 rounded-2xl border border-line bg-gradient-to-br from-accent/15 via-surface to-surface p-6 text-center md:p-10">
        <h2 className="text-xl font-bold md:text-2xl">도입을 고민 중이신가요?</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm text-muted">
          업무 내용을 간단히 보내주시면 적용 가능 여부와 예상 절감 효과를 무료로
          진단해 드립니다.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center">
          {!alreadyPurchased && (
            <Link
              href={checkoutHref}
              className="rounded-lg bg-accent px-8 py-3 font-medium text-white transition hover:bg-accent/80"
            >
              {product.name} 구매하기
            </Link>
          )}
          <a
            href="mailto:contact@goodautosystems.com?subject=%EB%8F%84%EC%9E%85%20%EB%AC%B8%EC%9D%98"
            className="rounded-lg border border-line px-8 py-3 font-medium text-muted transition hover:border-accent/60 hover:text-foreground"
          >
            무료 진단 문의
          </a>
        </div>
      </section>

      {/* 모바일 하단 고정 구매 바 (lg 미만) */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-background/95 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="min-w-0">
            <p className="truncate text-xs text-muted">{product.name}</p>
            <p className="text-lg font-bold">
              {product.price.toLocaleString()}
              <span className="ml-1 text-sm font-normal text-muted">원</span>
            </p>
          </div>
          {alreadyPurchased ? (
            <Link
              href="/mypage"
              className="shrink-0 rounded-lg border border-accent px-5 py-3 text-sm font-medium text-accent transition hover:bg-accent/10"
            >
              마이페이지
            </Link>
          ) : (
            <Link
              href={checkoutHref}
              className="shrink-0 rounded-lg bg-accent px-6 py-3 text-sm font-medium text-white transition hover:bg-accent/80"
            >
              구매하기
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
