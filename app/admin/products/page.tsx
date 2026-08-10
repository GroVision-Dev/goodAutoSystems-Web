import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { toggleProductActive, deleteProduct } from "@/app/admin/actions";
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
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-muted">
              <th className="p-4 font-normal">상품명</th>
              <th className="p-4 font-normal">카테고리</th>
              <th className="p-4 font-normal">가격</th>
              <th className="p-4 font-normal">노출</th>
              <th className="p-4 font-normal">관리</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id} className="border-b border-line/50">
                <td className="p-4">
                  {product.name}
                  <span className="block text-xs text-muted">{product.slug}</span>
                </td>
                <td className="p-4">{CATEGORY_LABEL[product.category]}</td>
                <td className="p-4">{product.price.toLocaleString()}원</td>
                <td className="p-4">
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
                <td className="p-4">
                  <div className="flex gap-2">
                    <Link
                      href={`/admin/products?edit=${product.id}`}
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

      <div className="mt-8 rounded-2xl border border-line bg-surface p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">{editing ? `상품 수정 — ${editing.name}` : "새 상품 등록"}</h2>
          {editing && (
            <Link href="/admin/products" className="text-sm text-muted hover:text-foreground">
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
