/** 운영 도메인 (robots·sitemap·문자 링크 공통). AUTH_URL이 서비스 도메인이다 */
export function siteUrl(): string {
  return (process.env.AUTH_URL ?? "https://optix.goodautosys.kr").replace(/\/$/, "");
}
