import type { Metadata } from "next";
import "./globals.css";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import FloatingContact from "@/components/floating-contact";
import PageViewTracker from "@/components/page-view-tracker";

export const metadata: Metadata = {
  title: {
    default: "Optix",
    template: "%s | Optix",
  },
  description:
    "업무 자동화 프로그램과 AI 자동화 솔루션을 제공하는 Optix입니다.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="min-h-full flex flex-col">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
        <FloatingContact />
        <PageViewTracker />
      </body>
    </html>
  );
}
