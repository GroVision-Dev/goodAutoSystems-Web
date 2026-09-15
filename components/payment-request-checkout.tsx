"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PortOne from "@portone/browser-sdk/v2";

const inputClass =
  "w-full rounded-lg border border-line bg-surface-2 px-4 py-3 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none";

interface CreatedOrder {
  orderId: string;
  amount: number;
  orderName: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
}

/** 비회원 단건 결제: 이메일·동의 입력 → 주문 생성 → 포트원 카드 결제창 */
export default function PaymentRequestCheckout({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const agree = form.get("agree") === "on";
    if (!agree) {
      setError("개인정보 수집·이용 및 제공에 동의해 주세요.");
      return;
    }

    const storeId = process.env.NEXT_PUBLIC_PORTONE_STORE_ID;
    const channelKey = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY;
    if (!storeId || !channelKey) {
      setError("결제 설정이 완료되지 않았습니다. 담당자에게 문의해 주세요.");
      return;
    }

    setPaying(true);
    try {
      const res = await fetch(`/api/pay/${encodeURIComponent(token)}/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, agree }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "결제를 시작하지 못했습니다.");
      const order = data as CreatedOrder;

      const response = await PortOne.requestPayment({
        storeId,
        channelKey,
        paymentId: order.orderId,
        orderName: order.orderName,
        // 표시용 금액일 뿐, 실제 결제 금액은 서버가 포트원 조회로 요청 금액과 대조한다
        totalAmount: order.amount,
        currency: "KRW",
        payMethod: "CARD",
        customer: {
          fullName: order.customerName,
          phoneNumber: order.customerPhone,
          email: order.customerEmail,
        },
        redirectUrl: `${window.location.origin}/pay/${token}/complete`,
      });

      if (!response || response.code !== undefined) {
        setError(response?.message ?? "결제가 취소되었습니다.");
        setPaying(false);
        return;
      }
      router.push(`/pay/${token}/complete?paymentId=${encodeURIComponent(response.paymentId)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "결제 요청 중 오류가 발생했습니다.");
      setPaying(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-6">
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-muted">
          이메일 <span className="text-red-400">*</span>
          <span className="ml-1 text-xs">(카드 매출전표 발송 · 결제사 필수 항목)</span>
        </span>
        <input
          name="email"
          type="email"
          required
          maxLength={254}
          autoComplete="email"
          autoCapitalize="none"
          placeholder="name@example.com"
          className={inputClass}
        />
      </label>

      <label className="flex items-start gap-2.5 rounded-lg border border-line bg-surface-2/60 p-4 text-xs leading-relaxed text-muted">
        <input type="checkbox" name="agree" required className="mt-0.5 h-4 w-4 shrink-0 accent-accent" />
        <span>
          <span className="text-red-400">[필수]</span> 결제 처리를 위한 개인정보 수집·이용 및 제공에 동의합니다.
          <span className="mt-1 block">
            수집 항목: 이름, 휴대폰 번호, 이메일 · 목적: 결제 처리·결제 내역 안내·환불 · 보유 기간: 전자상거래법에
            따라 5년 · 처리위탁: 포트원(PortOne) 및 연동 PG사. 동의를 거부할 수 있으며, 거부 시 결제가
            제한됩니다. 결제를 진행하면{" "}
            <Link href="/terms" target="_blank" className="underline hover:text-foreground">
              이용약관
            </Link>
            의 환불 조항과{" "}
            <Link href="/privacy" target="_blank" className="underline hover:text-foreground">
              개인정보처리방침
            </Link>
            을 확인한 것으로 봅니다.
          </span>
        </span>
      </label>

      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={paying}
        className="w-full rounded-lg bg-accent py-4 font-medium text-white transition hover:bg-accent/80 disabled:opacity-50"
      >
        {paying ? "결제 진행 중..." : "카드로 결제하기"}
      </button>
    </form>
  );
}
