"use client";

import { useActionState, useState } from "react";
import { updateInquiry, type InquiryActionState } from "@/app/optix-dev/inquiries/actions";

const inputClass =
  "rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none";

/** 문의 카드 하단: 처리 상태 변경 + 관리자 메모 */
export default function AdminInquiryControls({
  id,
  status,
  adminMemo,
}: {
  id: string;
  status: "NEW" | "IN_PROGRESS" | "DONE";
  adminMemo: string | null;
}) {
  const [state, action, pending] = useActionState<InquiryActionState, FormData>(updateInquiry, {});
  const [memoOpen, setMemoOpen] = useState(Boolean(adminMemo));

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      <div className="flex flex-wrap items-center gap-2">
        <select name="status" defaultValue={status} className={inputClass} aria-label="처리 상태">
          <option value="NEW">신규</option>
          <option value="IN_PROGRESS">진행 중</option>
          <option value="DONE">처리 완료</option>
        </select>
        <button
          type="button"
          onClick={() => setMemoOpen((v) => !v)}
          className="rounded-lg border border-line px-3 py-2 text-xs text-muted transition hover:text-foreground"
        >
          {memoOpen ? "메모 접기" : adminMemo ? "메모 보기" : "메모 추가"}
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-accent px-4 py-2 text-xs font-medium text-white transition hover:bg-accent/80 disabled:opacity-50"
        >
          {pending ? "저장 중..." : "저장"}
        </button>
        {state.error && <span className="text-xs text-red-400">{state.error}</span>}
        {state.message && !state.error && <span className="text-xs text-accent">{state.message}</span>}
      </div>
      <textarea
        name="adminMemo"
        defaultValue={adminMemo ?? ""}
        rows={3}
        maxLength={1000}
        placeholder="통화 내용, 견적, 후속 일정 등 (회원에게 보이지 않음)"
        className={`${inputClass} w-full resize-y ${memoOpen ? "" : "hidden"}`}
      />
    </form>
  );
}
