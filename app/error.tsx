"use client";

import Link from "next/link";

/**
 * 공통 오류 화면. 오류 메시지·스택은 내부 경로가 드러날 수 있으므로 표시하지 않고,
 * 서버 로그와 대조할 수 있는 digest(오류 코드)만 보여준다.
 */
export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <div className="mx-auto max-w-md px-4 py-24">
      <div className="rounded-2xl border border-line bg-surface p-10 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-500/15 text-3xl text-red-400">
          !
        </div>
        <h1 className="mt-6 text-xl font-bold">일시적인 오류가 발생했습니다</h1>
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
          <Link href="/" className="text-sm text-muted hover:text-foreground">
            홈으로
          </Link>
        </div>
      </div>
    </div>
  );
}
