"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import PortOne from "@portone/browser-sdk/v2";

type Props = { slug: string; invoiceId?: never } | { invoiceId: string; slug?: never };

export default function PortOneCheckout(props: Props) {
  const { slug, invoiceId } = props;
  const orderRef = useRef<{
    orderId: string;
    amount: number;
    orderName: string;
    customerName: string;
    customerPhone: string;
  } | null>(null);
  const router = useRouter();
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
          body: JSON.stringify(slug ? { slug } : { invoiceId }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error ?? "주문 생성에 실패했습니다.");
        }
        const order = await res.json();
        if (cancelled) return;
        orderRef.current = order;
        setReady(true);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "주문을 생성하지 못했습니다.");
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [slug, invoiceId]);

  async function handlePay() {
    const order = orderRef.current;
    if (!order) return;

    const storeId = process.env.NEXT_PUBLIC_PORTONE_STORE_ID;
    const channelKey = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY;
    if (!storeId || !channelKey) {
      setError("결제 설정이 완료되지 않았습니다. 관리자에게 문의해 주세요.");
      return;
    }

    setPaying(true);
    try {
      const response = await PortOne.requestPayment({
        storeId,
        channelKey,
        // 포트원 paymentId로 주문번호를 그대로 사용해 서버에서 주문을 역조회한다
        paymentId: order.orderId,
        orderName: order.orderName,
        totalAmount: order.amount,
        currency: "KRW",
        payMethod: "CARD",
        customer: {
          fullName: order.customerName,
          phoneNumber: order.customerPhone,
        },
        // 모바일 등 리디렉션 방식일 때 결제창이 돌아올 주소
        redirectUrl: `${window.location.origin}/checkout/success`,
      });

      // 리디렉션 방식이면 여기 도달하지 않고 redirectUrl로 이동한다
      if (!response || response.code !== undefined) {
        // 사용자가 결제창을 닫은 경우 등
        setError(response?.message ?? "결제가 취소되었습니다.");
        setPaying(false);
        return;
      }
      router.push(`/checkout/success?paymentId=${encodeURIComponent(response.paymentId)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "결제 요청 중 오류가 발생했습니다.");
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
    <div className="rounded-2xl border border-line bg-surface p-6">
      <p className="text-sm text-muted">
        결제하기 버튼을 누르면 결제창이 열립니다. 결제 완료 후 자동으로 결과
        페이지로 이동합니다.
      </p>
      <button
        onClick={handlePay}
        disabled={!ready || paying}
        className="mt-4 w-full rounded-lg bg-accent py-4 font-medium text-white transition hover:bg-accent/80 disabled:opacity-50"
      >
        {ready ? (paying ? "결제 진행 중..." : "결제하기") : "주문 준비 중..."}
      </button>
    </div>
  );
}
