import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { toggleProductActive, deleteProduct } from "@/app/optix-dev/actions";
import AdminProductForm from "@/components/admin-product-form";

export const metadata = { title: "상품관리" };

const CATEGORY_LABEL: Record<string, string> = {
  PROGRAM: "프로그램",
  AI_SERVICE: "AI 자동화",
};

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const { edit } = await searchParams;
  const products = await prisma.product.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { orders: true } } },
  });
  const editing = edit ? products.find((p) => p.id === edit) : undefined;

  return (
    <div>
      <h1 className="text-2xl font-bold">상품관리</h1>

      <div className="mt-8 overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs text-muted">
              <th className="whitespace-nowrap p-4 font-normal">상품명</th>
              <th className="whitespace-nowrap p-4 font-normal">카테고리</th>
              <th className="whitespace-nowrap p-4 font-normal">가격</th>
              <th className="whitespace-nowrap p-4 font-normal">판매</th>
              <th className="whitespace-nowrap p-4 font-normal">노출</th>
              <th className="whitespace-nowrap p-4 font-normal">관리</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id} className="border-b border-line/50">
                <td className="p-4">
                  <span className={editing?.id === product.id ? "font-medium text-accent" : ""}>
                    {product.name}
                  </span>
                  <span className="block font-mono text-xs text-muted">{product.slug}</span>
                </td>
                <td className="whitespace-nowrap p-4">{CATEGORY_LABEL[product.category]}</td>
                <td className="whitespace-nowrap p-4">{product.price.toLocaleString()}원</td>
                <td className="whitespace-nowrap p-4 text-muted">{product._count.orders}건</td>
                <td className="whitespace-nowrap p-4">
                  {product.isActive ? (
                    <span className="rounded-full bg-accent/15 px-2.5 py-1 text-xs text-accent">
                      노출중
                    </span>
                  ) : (
                    <span className="rounded-full bg-muted/15 px-2.5 py-1 text-xs text-muted">
                      숨김
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap p-4">
                  <div className="flex gap-2">
                    <Link
                      href={`/optix-dev/products?edit=${product.id}#product-form`}
                      className="rounded-lg border border-line px-3 py-1.5 text-xs text-muted transition hover:text-foreground"
                    >
                      수정
                    </Link>
                    <form
                      action={async () => {
                        "use server";
                        await toggleProductActive(product.id);
                      }}
                    >
                      <button
                        type="submit"
                        className="rounded-lg border border-line px-3 py-1.5 text-xs text-muted transition hover:text-foreground"
                      >
                        {product.isActive ? "숨기기" : "노출"}
                      </button>
                    </form>
                    {product._count.orders === 0 && (
                      <form
                        action={async () => {
                          "use server";
                          await deleteProduct(product.id);
                        }}
                      >
                        <button
                          type="submit"
                          className="rounded-lg border border-red-500/40 px-3 py-1.5 text-xs text-red-400 transition hover:bg-red-500/10"
                        >
                          삭제
                        </button>
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-muted">
        주문이 있는 상품은 삭제할 수 없습니다. 판매를 멈추려면 &quot;숨기기&quot;를 사용하세요.
      </p>

      <div id="product-form" className="mt-8 scroll-mt-24 rounded-2xl border border-line bg-surface p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">{editing ? `상품 수정 — ${editing.name}` : "새 상품 등록"}</h2>
          {editing && (
            <Link href="/optix-dev/products" className="text-sm text-muted hover:text-foreground">
              등록 모드로
            </Link>
          )}
        </div>
        <div className="mt-6">
          <AdminProductForm key={editing?.id ?? "new"} product={editing} />
        </div>
      </div>
    </div>
  );
}
