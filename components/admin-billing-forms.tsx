"use client";

import { useActionState, useState } from "react";
import {
  createInvoice,
  generateMonthlyInvoices,
  issueScheduledInvoice,
  sendInvoiceNotice,
  setMonthlyFee,
  type BillingActionState,
} from "@/app/optix-dev/billing/actions";

const inputClass =
  "rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none";

function Feedback({ state }: { state: BillingActionState }) {
  if (state.error) return <p className="text-xs text-red-400">{state.error}</p>;
  if (state.message) return <p className="text-xs text-accent">{state.message}</p>;
  return null;
}

function NotifyCheckbox({ defaultChecked = true }: { defaultChecked?: boolean }) {
  return (
    <label className="flex items-center gap-2 text-xs text-muted">
      <input
        type="checkbox"
        name="notify"
        defaultChecked={defaultChecked}
        className="h-3.5 w-3.5 accent-accent"
      />
      회원에게 청구서 안내 문자 발송
    </label>
  );
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
      <NotifyCheckbox />
      <p className="text-xs text-muted">
        월 결제 금액이 설정된 활성 회원 중 해당 월 청구서가 없는 회원에게만 생성됩니다.
        결제 예정일은 회원별 결제일로 자동 계산됩니다.
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
  billingDay: number | null;
}

/** 개별 청구서 발행. 회원을 고르면 설정된 금액·항목·결제일을 채워 넣는다 */
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
  const [selected, setSelected] = useState<UserOption | null>(null);
  const [title, setTitle] = useState("월 이용료");
  const [amount, setAmount] = useState("");
  const [billingDay, setBillingDay] = useState("");

  function handleSelect(userId: string) {
    const user = users.find((u) => u.id === userId) ?? null;
    setSelected(user);
    if (user?.monthlyTitle) setTitle(user.monthlyTitle);
    if (user?.monthlyAmount) setAmount(String(user.monthlyAmount));
    setBillingDay(user?.billingDay ? String(user.billingDay) : "");
  }

  return (
    <form action={action} className="grid gap-3 md:grid-cols-2">
      <select
        name="userId"
        required
        className={`${inputClass} md:col-span-2`}
        defaultValue=""
        onChange={(e) => handleSelect(e.target.value)}
      >
        <option value="" disabled>
          회원 선택
        </option>
        {users.map((user) => (
          <option key={user.id} value={user.id}>
            {user.name} ({user.username})
            {user.monthlyAmount ? ` · 월 ${user.monthlyAmount.toLocaleString()}원` : ""}
            {user.billingDay ? ` · ${user.billingDay}일` : ""}
          </option>
        ))}
      </select>
      <input type="month" name="billingMonth" defaultValue={defaultMonth} required className={inputClass} />
      <input
        name="title"
        placeholder="항목명 (예: 월 이용료)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        className={inputClass}
      />
      <input
        type="number"
        name="amount"
        placeholder="금액 (원)"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        min={100}
        step={100}
        required
        className={inputClass}
      />
      <div className="flex items-center gap-2">
        <input
          type="number"
          name="billingDay"
          placeholder="결제일 (1~31)"
          value={billingDay}
          onChange={(e) => setBillingDay(e.target.value)}
          min={1}
          max={31}
          className={`${inputClass} w-full`}
        />
        <span className="shrink-0 text-xs text-muted">일</span>
      </div>
      <input name="memo" placeholder="메모 (선택, 회원에게 표시)" className={`${inputClass} md:col-span-2`} />
      {selected && !selected.billingDay && !billingDay && (
        <p className="text-xs text-yellow-400 md:col-span-2">
          이 회원은 결제일이 설정되지 않았습니다. 결제일을 비우면 청구서에 결제 예정일이 표시되지 않습니다.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3 md:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg border border-accent px-4 py-2 text-sm font-medium text-accent transition hover:bg-accent/10 disabled:opacity-50"
        >
          {pending ? "발행 중..." : "청구서 발행"}
        </button>
        <NotifyCheckbox />
      </div>
      <div className="md:col-span-2">
        <Feedback state={state} />
      </div>
    </form>
  );
}

/** 회원관리 인라인: 회원별 월 결제 설정 (금액·항목·결제일) */
export function MonthlyFeeForm({
  userId,
  amount,
  title,
  billingDay,
}: {
  userId: string;
  amount: number | null;
  title: string | null;
  billingDay: number | null;
}) {
  const [state, action, pending] = useActionState<BillingActionState, FormData>(
    setMonthlyFee,
    {}
  );
  return (
    <form action={action} className="flex flex-col gap-1.5">
      <input type="hidden" name="userId" value={userId} />
      <div className="flex flex-nowrap items-center gap-1.5">
        <input
          type="number"
          name="amount"
          defaultValue={amount ?? ""}
          placeholder="금액(원)"
          min={0}
          step={100}
          aria-label="월 결제 금액"
          className={`${inputClass} w-24 px-2 py-1.5 text-xs`}
        />
        <input
          name="title"
          defaultValue={title ?? ""}
          placeholder="항목명"
          aria-label="월 결제 항목명"
          className={`${inputClass} w-24 px-2 py-1.5 text-xs`}
        />
        <div className="flex items-center gap-1">
          <span className="text-[11px] text-muted">매월</span>
          <input
            type="number"
            name="billingDay"
            defaultValue={billingDay ?? ""}
            placeholder="일"
            min={1}
            max={31}
            aria-label="결제일"
            className={`${inputClass} w-14 px-2 py-1.5 text-center text-xs`}
          />
          <span className="text-[11px] text-muted">일</span>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="shrink-0 whitespace-nowrap rounded-lg border border-line px-2.5 py-1.5 text-xs text-muted transition hover:border-accent/60 hover:text-foreground disabled:opacity-50"
        >
          {pending ? "저장..." : "저장"}
        </button>
      </div>
      <Feedback state={state} />
    </form>
  );
}

/** 결제 예정 회원 행: 청구서 발행(+문자) */
export function IssueInvoiceButton({
  userId,
  billingMonth,
}: {
  userId: string;
  billingMonth: string;
}) {
  const [state, action, pending] = useActionState<BillingActionState, FormData>(
    issueScheduledInvoice,
    {}
  );
  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="billingMonth" value={billingMonth} />
      <div className="flex gap-1.5">
        <button
          type="submit"
          name="notify"
          value="on"
          disabled={pending}
          className="whitespace-nowrap rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white transition hover:bg-accent/80 disabled:opacity-50"
        >
          {pending ? "처리 중..." : "발행 + 문자"}
        </button>
        <button
          type="submit"
          name="notify"
          value="off"
          disabled={pending}
          className="whitespace-nowrap rounded-lg border border-line px-3 py-1.5 text-xs text-muted transition hover:text-foreground disabled:opacity-50"
        >
          발행만
        </button>
      </div>
      <Feedback state={state} />
    </form>
  );
}

/** 미납 청구서 행: 안내 문자 (재)발송 */
export function SendNoticeButton({
  invoiceId,
  notifiedAt,
}: {
  invoiceId: string;
  notifiedAt: string | null;
}) {
  const [state, action, pending] = useActionState<BillingActionState, FormData>(
    sendInvoiceNotice,
    {}
  );
  return (
    <form action={action} className="flex flex-col items-start gap-1">
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <button
        type="submit"
        disabled={pending}
        className="whitespace-nowrap rounded-lg border border-accent/40 px-3 py-1.5 text-xs text-accent transition hover:bg-accent/10 disabled:opacity-50"
        title={notifiedAt ? `마지막 발송 ${notifiedAt}` : "아직 발송 안 함"}
      >
        {pending ? "발송 중..." : notifiedAt ? "문자 재발송" : "문자 발송"}
      </button>
      <Feedback state={state} />
    </form>
  );
}
