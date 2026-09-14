import Link from "next/link";

export const metadata = { title: "페이지를 찾을 수 없습니다" };

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-24">
      <div className="rounded-2xl border border-line bg-surface p-10 text-center">
        <p className="text-4xl font-bold text-accent">404</p>
        <h1 className="mt-4 text-xl font-bold">페이지를 찾을 수 없습니다</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          주소가 잘못되었거나 삭제된 페이지입니다.
        </p>
        <div className="mt-8 flex flex-col gap-3">
          <Link
            href="/"
            className="rounded-lg bg-accent py-3 font-medium text-white transition hover:bg-accent/80"
          >
            홈으로
          </Link>
          <Link href="/products" className="text-sm text-muted hover:text-foreground">
            상품 보러가기
          </Link>
        </div>
      </div>
    </div>
  );
}
