import type { NextConfig } from "next";

/**
 * 모든 응답에 붙는 보안 헤더.
 * CSP는 결제창(포트원·PG사 iframe/폼/스크립트)을 깨뜨리지 않도록 프레임 삽입·base·object만 제한한다.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'; base-uri 'self'; object-src 'none'" },
];

/** 개인정보·결제 화면은 브라우저·프록시 캐시에 남기지 않는다 */
const noStoreHeaders = [{ key: "Cache-Control", value: "no-store" }];

const nextConfig: NextConfig = {
  // Docker 배포용 self-contained 서버 번들 생성
  output: "standalone",
  // 운영 빌드에서 브라우저 소스맵(.map) 미생성 — 원본 소스 노출 방지 (기본값이지만 명시)
  productionBrowserSourceMaps: false,
  // X-Powered-By: Next.js 헤더 제거
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/optix-dev/:path*", headers: noStoreHeaders },
      { source: "/mypage", headers: noStoreHeaders },
      { source: "/checkout/:path*", headers: noStoreHeaders },
      { source: "/pay/:path*", headers: noStoreHeaders },
    ];
  },
};

export default nextConfig;
