import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { siteUrl } from "@/lib/site-url";

/** /sitemap.xml — 공개 페이지 + 노출 중인 상품 상세 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/products`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/services`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ];

  let products: { slug: string; createdAt: Date }[] = [];
  try {
    products = await prisma.product.findMany({
      where: { isActive: true },
      select: { slug: true, createdAt: true },
    });
  } catch (e) {
    console.error("[sitemap] 상품 조회 실패", e);
  }

  return [
    ...staticPages,
    ...products.map((p) => ({
      url: `${base}/products/${p.slug}`,
      lastModified: p.createdAt,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
