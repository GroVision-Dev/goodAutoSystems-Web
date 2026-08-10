import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker 배포용 self-contained 서버 번들 생성
  output: "standalone",
};

export default nextConfig;
