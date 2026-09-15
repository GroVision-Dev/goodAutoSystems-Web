import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

/**
 * /robots.txt — API·개인 페이지·결제 경로는 검색엔진 수집 제외.
 * 관리자 경로는 robots.txt에 적으면 누구나 경로를 알 수 있으므로 넣지 않는다
 * (관리자 레이아웃의 noindex 메타 태그로 수집을 막는다).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/mypage", "/checkout/", "/pay/", "/login", "/register"],
      },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
    host: siteUrl(),
  };
}
