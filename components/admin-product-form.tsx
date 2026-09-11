"use client";

import { useActionState, useState } from "react";
import { saveProduct, type ProductFormState } from "@/app/optix-dev/actions";
import type { Product } from "@prisma/client";

const inputClass =
  "w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none";

export default function AdminProductForm({ product }: { product?: Product }) {
  const [state, formAction, pending] = useActionState<ProductFormState, FormData>(
    saveProduct,
    {}
  );
  const [billingType, setBillingType] = useState<"ONE_TIME" | "MONTHLY">(
    product?.billingType ?? "ONE_TIME"
  );
  const monthly = billingType === "MONTHLY";

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
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-muted">결제 유형</span>
          <select
            name="billingType"
            value={billingType}
            onChange={(e) => setBillingType(e.target.value as "ONE_TIME" | "MONTHLY")}
            className={inputClass}
          >
            <option value="ONE_TIME">1회 결제 (총액)</option>
            <option value="MONTHLY">월 결제 (1개월 이용료 · 첫 달 결제 후 청구서)</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-muted">{monthly ? "월 이용료 (원, 1개월 기준)" : "가격 (원)"}</span>
          <input
            name="price"
            type="number"
            required
            min={100}
            defaultValue={product?.price}
            placeholder={monthly ? "2500000" : "300000"}
            className={inputClass}
          />
        </label>
        {monthly && (
          <div className="flex flex-col gap-1.5 text-sm">
            <span className="text-muted">계약 기간 (개월, 비우면 제한 없음)</span>
            <div className="flex items-center gap-2">
              <input
                name="minMonths"
                type="number"
                min={1}
                max={36}
                defaultValue={product?.minMonths ?? ""}
                placeholder="최소"
                aria-label="최소 계약 개월"
                className={inputClass}
              />
              <span className="shrink-0 text-muted">~</span>
              <input
                name="maxMonths"
                type="number"
                min={1}
                max={36}
                defaultValue={product?.maxMonths ?? ""}
                placeholder="최대"
                aria-label="최대 계약 개월"
                className={inputClass}
              />
              <span className="shrink-0 text-xs text-muted">개월</span>
            </div>
          </div>
        )}
      </div>
      {monthly && (
        <p className="rounded-lg border border-accent-2/30 bg-accent-2/5 px-4 py-3 text-xs leading-relaxed text-muted">
          월 결제 상품은 구매 시 첫 달 이용료만 결제됩니다. 결제가 완료되면 회원의 월 결제
          설정(금액·항목·결제일=결제한 날짜)이 자동 등록되고 이번 달 청구서가 납부 완료로
          생성됩니다. 다음 달부터는 월결제 관리에서 청구서를 발행해 주세요.
        </p>
      )}
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
