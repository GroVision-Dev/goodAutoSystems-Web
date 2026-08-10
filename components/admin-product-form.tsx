"use client";

import { useActionState } from "react";
import { saveProduct, type ProductFormState } from "@/app/admin/actions";
import type { Product } from "@prisma/client";

const inputClass =
  "w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none";

export default function AdminProductForm({ product }: { product?: Product }) {
  const [state, formAction, pending] = useActionState<ProductFormState, FormData>(
    saveProduct,
    {}
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {product && <input type="hidden" name="id" value={product.id} />}
      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-muted">상품명</span>
          <input
            name="name"
            required
            defaultValue={product?.name}
            placeholder="예: GoodAuto Pro"
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-muted">슬러그 (URL용, 영문 소문자·숫자·하이픈)</span>
          <input
            name="slug"
            required
            defaultValue={product?.slug}
            placeholder="예: goodauto-pro"
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-muted">가격 (원)</span>
          <input
            name="price"
            type="number"
            required
            min={100}
            defaultValue={product?.price}
            placeholder="99000"
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-muted">카테고리</span>
          <select
            name="category"
            defaultValue={product?.category ?? "PROGRAM"}
            className={inputClass}
          >
            <option value="PROGRAM">프로그램</option>
            <option value="AI_SERVICE">AI 자동화</option>
          </select>
        </label>
      </div>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-muted">요약 (한 줄 소개)</span>
        <input
          name="summary"
          required
          defaultValue={product?.summary}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-muted">상세 설명</span>
        <textarea
          name="description"
          required
          rows={6}
          defaultValue={product?.description}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-muted">
          다운로드 파일명 (프로그램 상품만, private-files/ 내 파일명)
        </span>
        <input
          name="downloadFile"
          defaultValue={product?.downloadFile ?? ""}
          placeholder="예: goodauto-pro-setup.zip"
          className={inputClass}
        />
      </label>

      {state.error && <p className="text-sm text-red-400">{state.error}</p>}
      {state.ok && <p className="text-sm text-accent">저장되었습니다.</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded-lg bg-accent px-6 py-2.5 text-sm font-medium text-white transition hover:bg-accent/80 disabled:opacity-50"
      >
        {pending ? "저장 중..." : product ? "상품 수정" : "상품 등록"}
      </button>
    </form>
  );
}
