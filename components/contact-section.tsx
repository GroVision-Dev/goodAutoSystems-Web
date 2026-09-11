import { prisma } from "@/lib/prisma";
import { SITE_INFO } from "@/lib/site-config";
import InquiryForm, { type InquiryProductOption } from "@/components/inquiry-form";

/** 문의 폼의 관심 상품 목록 (조회 실패 시 빈 목록) */
export async function loadInquiryProducts(): Promise<InquiryProductOption[]> {
  try {
    return await prisma.product.findMany({
      where: { isActive: true },
      orderBy: [{ category: "asc" }, { price: "asc" }],
      select: { slug: true, name: true },
    });
  } catch (e) {
    console.error("[contact] 상품 목록 조회 실패", e);
    return [];
  }
}

/** 홈 하단 도입 문의 섹션 — 문의 폼을 바로 작성해 접수한다 */
export default async function ContactSection() {
  const products = await loadInquiryProducts();

  return (
    <section id="contact" className="scroll-mt-16 border-t border-line bg-surface/40">
      <div className="mx-auto max-w-6xl px-4 py-16 md:py-28">
        <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr] lg:gap-14">
          <div>
            <p className="text-sm font-medium text-accent-2 md:text-base">CONTACT</p>
            <h2 className="mt-3 text-2xl font-bold sm:text-3xl md:text-4xl">
              우리 회사 업무도
              <br />
              자동화할 수 있을까요?
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted md:text-base">
              업무 내용을 간단히 남겨주시면, 적용 가능 여부와 예상 절감 효과를
              무료로 진단해 드립니다. 영업일 기준 1일 내에 연락드립니다.
            </p>
            <dl className="mt-8 flex flex-col gap-3 text-sm">
              <div className="flex gap-4">
                <dt className="w-14 shrink-0 text-muted">전화</dt>
                <dd>
                  <a href={`tel:${SITE_INFO.phone.replace(/\D/g, "")}`} className="hover:text-accent">
                    {SITE_INFO.phone}
                  </a>
                </dd>
              </div>
              <div className="flex gap-4">
                <dt className="w-14 shrink-0 text-muted">이메일</dt>
                <dd>
                  <a href={`mailto:${SITE_INFO.email}`} className="hover:text-accent">
                    {SITE_INFO.email}
                  </a>
                </dd>
              </div>
              <div className="flex gap-4">
                <dt className="w-14 shrink-0 text-muted">상담</dt>
                <dd className="text-muted">{SITE_INFO.supportHours}</dd>
              </div>
            </dl>
          </div>
          <div className="rounded-2xl border border-line bg-gradient-to-br from-accent/10 via-surface to-surface p-5 sm:rounded-3xl sm:p-8">
            <InquiryForm products={products} />
          </div>
        </div>
      </div>
    </section>
  );
}
