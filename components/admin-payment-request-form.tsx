"use client";

import { useActionState } from "react";
import {
  createPaymentRequest,
  type PaymentRequestActionState,
} from "@/app/optix-dev/payment-requests/actions";

const inputClass =
  "w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none";

/** 비회원 단건 결제 요청 생성 폼 (유효기간 기본값·최대값은 서버 페이지에서 전달) */
export default function AdminPaymentRequestForm({
  defaultDays,
  maxDays,
}: {
  defaultDays: number;
  maxDays: number;
}) {
  const [state, action, pending] = useActionState<PaymentRequestActionState, FormData>(
    createPaymentRequest,
    {}
  );

  return (
    <form action={action} className="grid gap-3 md:grid-cols-2">
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-muted">받는 분 이름</span>
        <input name="recipientName" required minLength={2} maxLength={40} placeholder="홍길동" className={inputClass} />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-muted">휴대폰 번호</span>
        <input
          name="recipientPhone"
          type="tel"
          inputMode="tel"
          required
          placeholder="010-0000-0000"
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-muted">항목명</span>
        <input name="title" required maxLength={60} placeholder="예: 엑셀 자동화 구축비" className={inputClass} />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-muted">금액 (원, 부가세 포함)</span>
        <input
          name="amount"
          type="number"
          required
          min={100}
          max={100000000}
          step={1}
          placeholder="1500000"
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm md:col-span-2">
        <span className="text-muted">메모 (선택, 고객 결제 화면에 표시)</span>
        <input name="memo" maxLength={200} placeholder="예: 9월 작업분 · 견적서 기준" className={inputClass} />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-muted">유효기간 (일, 최대 {maxDays}일)</span>
        <input
          name="validDays"
          type="number"
          min={1}
          max={maxDays}
          defaultValue={defaultDays}
          className={inputClass}
        />
      </label>
      <label className="flex items-center gap-2 self-end pb-2 text-sm text-muted">
        <input type="checkbox" name="notify" defaultChecked className="h-4 w-4 accent-accent" />
        받는 분에게 결제 링크 문자 발송
      </label>
      <div className="flex flex-wrap items-center gap-3 md:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-accent/80 disabled:opacity-50"
        >
          {pending ? "처리 중..." : "결제 요청 만들기"}
        </button>
        {state.error && <p className="text-sm text-red-400">{state.error}</p>}
        {state.message && !state.error && <p className="text-sm text-accent">{state.message}</p>}
      </div>
    </form>
  );
}
