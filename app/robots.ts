import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

/** /robots.txt — 관리자·API·개인 페이지·결제 경로는 검색엔진 수집 제외 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/optix-dev/", "/api/", "/mypage", "/checkout/", "/login", "/register"],
      },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
    host: siteUrl(),
  };
}
