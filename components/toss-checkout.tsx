"use client";

import { useEffect, useRef, useState } from "react";
import { loadTossPayments, type TossPaymentsWidgets } from "@tosspayments/tosspayments-sdk";

interface Props {
  slug: string;
}

export default function TossCheckout({ slug }: Props) {
  const widgetsRef = useRef<TossPaymentsWidgets | null>(null);
  const orderRef = useRef<{
    orderId: string;
    amount: number;
    orderName: string;
    customerName: string;
    customerEmail: string;
  } | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const res = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error ?? "주문 생성에 실패했습니다.");
        }
        const order = await res.json();
        if (cancelled) return;
        orderRef.current = order;

        const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY!;
        const tossPayments = await loadTossPayments(clientKey);
        // 비회원 결제 위젯이 아닌 회원별 구분을 위해 customerKey에 이메일 기반 키 사용
        const widgets = tossPayments.widgets({
          customerKey: order.customerEmail.replace(/[^a-zA-Z0-9\-_=.@]/g, "_"),
        });
        await widgets.setAmount({ currency: "KRW", value: order.amount });
        await Promise.all([
          widgets.renderPaymentMethods({ selector: "#payment-method" }),
          widgets.renderAgreement({ selector: "#agreement" }),
        ]);
        if (cancelled) return;
        widgetsRef.current = widgets;
        setReady(true);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "결제 위젯을 불러오지 못했습니다.");
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  async function handlePay() {
    const widgets = widgetsRef.current;
    const order = orderRef.current;
    if (!widgets || !order) return;
    setPaying(true);
    try {
      await widgets.requestPayment({
        orderId: order.orderId,
        orderName: order.orderName,
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        successUrl: `${window.location.origin}/checkout/success`,
        failUrl: `${window.location.origin}/checkout/fail?orderId=${order.orderId}`,
      });
    } catch (e) {
      // 사용자가 결제창을 닫은 경우 등
      setError(e instanceof Error ? e.message : "결제가 취소되었습니다.");
      setPaying(false);
    }
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/40 bg-surface p-8 text-center">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-white">
      <div id="payment-method" />
      <div id="agreement" />
      <div className="p-6">
        <button
          onClick={handlePay}
          disabled={!ready || paying}
          className="w-full rounded-lg bg-accent py-4 font-medium text-white transition hover:bg-accent/80 disabled:opacity-50"
        >
          {ready ? (paying ? "결제 진행 중..." : "결제하기") : "결제 수단 불러오는 중..."}
        </button>
      </div>
    </div>
  );
}
