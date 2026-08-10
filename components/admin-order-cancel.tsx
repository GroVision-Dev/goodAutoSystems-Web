"use client";

import { useActionState, useState } from "react";
import { cancelOrder, type CancelOrderState } from "@/app/admin/actions";

export default function AdminOrderCancel({ orderId }: { orderId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<CancelOrderState, FormData>(
    cancelOrder,
    {}
  );

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-red-500/40 px-3 py-1.5 text-xs text-red-400 transition hover:bg-red-500/10"
      >
        결제취소
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="orderId" value={orderId} />
      <input
        name="reason"
        placeholder="취소 사유"
        defaultValue="관리자 취소"
        className="w-36 rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-xs text-foreground focus:border-accent focus:outline-none"
      />
      {state.error && (
        <p className="max-w-40 text-xs leading-snug text-red-400">{state.error}</p>
      )}
      <div className="flex gap-1.5">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-red-500/80 px-3 py-1.5 text-xs text-white transition hover:bg-red-500 disabled:opacity-50"
        >
          {pending ? "취소 중..." : "확정"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-line px-3 py-1.5 text-xs text-muted transition hover:text-foreground"
        >
          닫기
        </button>
      </div>
    </form>
  );
}
