"use client";

import { useActionState, useState } from "react";
import {
  resendPaymentRequest,
  type PaymentRequestActionState,
} from "@/app/optix-dev/payment-requests/actions";

/** 결제 링크 복사 (카카오톡 등으로 직접 전달할 때) */
export function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          window.prompt("결제 링크를 복사하세요", url);
        }
      }}
      className="whitespace-nowrap rounded-lg border border-line px-3 py-1.5 text-xs text-muted transition hover:text-foreground"
    >
      {copied ? "복사됨" : "링크 복사"}
    </button>
  );
}

export function ResendButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState<PaymentRequestActionState, FormData>(
    resendPaymentRequest,
    {}
  );
  return (
    <form action={action} className="flex flex-col items-start gap-1">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        className="whitespace-nowrap rounded-lg border border-accent/40 px-3 py-1.5 text-xs text-accent transition hover:bg-accent/10 disabled:opacity-50"
      >
        {pending ? "발송 중..." : "문자 재발송"}
      </button>
      {state.error && <p className="max-w-48 text-xs text-red-400">{state.error}</p>}
      {state.message && !state.error && <p className="text-xs text-accent">{state.message}</p>}
    </form>
  );
}
