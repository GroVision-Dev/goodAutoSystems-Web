"use client";

import { useActionState } from "react";
import {
  createInvoice,
  generateMonthlyInvoices,
  setMonthlyFee,
  type BillingActionState,
} from "@/app/admin/billing/actions";

const inputClass =
  "rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none";

function Feedback({ state }: { state: BillingActionState }) {
  if (state.error) return <p className="text-xs text-red-400">{state.error}</p>;
  if (state.message) return <p className="text-xs text-accent">{state.message}</p>;
  return null;
}

/** 월 청구서 일괄 생성 */
export function GenerateInvoicesForm({ defaultMonth }: { defaultMonth: string }) {
  const [state, action, pending] = useActionState<BillingActionState, FormData>(
    generateMonthlyInvoices,
    {}
  );
  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="month"
          name="billingMonth"
          defaultValue={defaultMonth}
          required
          className={inputClass}
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent/80 disabled:opacity-50"
        >
          {pending ? "생성 중..." : "해당 월 청구서 일괄 생성"}
        </button>
      </div>
      <p className="text-xs text-muted">
        월 결제 금액이 설정된 활성 회원 중 해당 월 청구서가 없는 회원에게만 생성됩니다.
      </p>
      <Feedback state={state} />
    </form>
  );
}

interface UserOption {
  id: string;
  name: string;
  username: string;
  monthlyAmount: number | null;
  monthlyTitle: string | null;
}

/** 개별 청구서 발행 */
export function CreateInvoiceForm({
  users,
  defaultMonth,
}: {
  users: UserOption[];
  defaultMonth: string;
}) {
  const [state, action, pending] = useActionState<BillingActionState, FormData>(
    createInvoice,
    {}
  );
  return (
    <form action={action} className="grid gap-3 md:grid-cols-2">
      <select name="userId" required className={`${inputClass} md:col-span-2`} defaultValue="">
        <option value="" disabled>
          회원 선택
        </option>
        {users.map((user) => (
          <option key={user.id} value={user.id}>
            {user.name} ({user.username})
            {user.monthlyAmount ? ` · 월 ${user.monthlyAmount.toLocaleString()}원` : ""}
          </option>
        ))}
      </select>
      <input type="month" name="billingMonth" defaultValue={defaultMonth} required className={inputClass} />
      <input
        name="title"
        placeholder="항목명 (예: 월 이용료)"
        defaultValue="월 이용료"
        required
        className={inputClass}
      />
      <input
        type="number"
        name="amount"
        placeholder="금액 (원)"
        min={100}
        step={100}
        required
        className={inputClass}
      />
      <input name="memo" placeholder="메모 (선택, 회원에게 표시)" className={inputClass} />
      <div className="flex items-center gap-3 md:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg border border-accent px-4 py-2 text-sm font-medium text-accent transition hover:bg-accent/10 disabled:opacity-50"
        >
          {pending ? "발행 중..." : "청구서 발행"}
        </button>
        <Feedback state={state} />
      </div>
    </form>
  );
}

/** 회원관리 인라인: 회원별 월 결제 설정 */
export function MonthlyFeeForm({
  userId,
  amount,
  title,
}: {
  userId: string;
  amount: number | null;
  title: string | null;
}) {
  const [state, action, pending] = useActionState<BillingActionState, FormData>(
    setMonthlyFee,
    {}
  );
  return (
    <form action={action} className="flex flex-col gap-1.5">
      <input type="hidden" name="userId" value={userId} />
      <div className="flex gap-1.5">
        <input
          type="number"
          name="amount"
          defaultValue={amount ?? ""}
          placeholder="금액"
          min={0}
          step={100}
          className={`${inputClass} w-24 px-2 py-1.5 text-xs`}
        />
        <input
          name="title"
          defaultValue={title ?? ""}
          placeholder="항목명"
          className={`${inputClass} w-24 px-2 py-1.5 text-xs`}
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg border border-line px-2.5 py-1.5 text-xs text-muted transition hover:border-accent/60 hover:text-foreground disabled:opacity-50"
        >
          {pending ? "저장..." : "저장"}
        </button>
      </div>
      <Feedback state={state} />
    </form>
  );
}
