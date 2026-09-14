"use client";

import "./globals.css";

/**
 * 루트 레이아웃까지 실패했을 때의 오류 화면 (자체 html/body 필요).
 * 오류 메시지·스택은 표시하지 않고 digest(오류 코드)만 보여준다.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <main className="mx-auto w-full max-w-md px-4 py-24">
          <div className="rounded-2xl border border-line bg-surface p-10 text-center">
            <h1 className="text-xl font-bold">일시적인 오류가 발생했습니다</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              잠시 후 다시 시도해 주세요. 문제가 계속되면 고객센터로 문의해 주세요.
            </p>
            {error.digest && <p className="mt-2 text-xs text-muted">오류 코드: {error.digest}</p>}
            <div className="mt-8 flex flex-col gap-3">
              <button
                type="button"
                onClick={() => retry()}
                className="rounded-lg bg-accent py-3 font-medium text-white transition hover:bg-accent/80"
              >
                다시 시도
              </button>
              {/* 루트 레이아웃이 없으므로 전체 새로고침 링크를 쓴다 */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a href="/" className="text-sm text-muted hover:text-foreground">
                홈으로
              </a>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
