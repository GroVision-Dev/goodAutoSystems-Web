"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PortOne from "@portone/browser-sdk/v2";

type Props = { slug: string; invoiceId?: never } | { invoiceId: string; slug?: never };

interface CreatedOrder {
  orderId: string;
  amount: number;
  orderName: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
}

export default function PortOneCheckout(props: Props) {
  const { slug, invoiceId } = props;
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  /** 이메일 도입 전 가입 회원은 이메일이 없어 결제창을 열 수 없다 (이니시스 V2 필수 항목) */
  const [missingEmail, setMissingEmail] = useState(false);

  // 진입 시에는 결제 가능 여부만 확인한다. 주문(PENDING)은 결제하기를 누를 때 만든다.
  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const res = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...(slug ? { slug } : { invoiceId }), dryRun: true }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error ?? "결제를 준비하지 못했습니다.");
        if (cancelled) return;
        if (!data?.hasEmail) {
          setMissingEmail(true);
          return;
        }
        setReady(true);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "결제를 준비하지 못했습니다.");
      }
    }

    check();
    return () => {
      cancelled = true;
    };
  }, [slug, invoiceId]);

  async function createOrder(): Promise<CreatedOrder | null> {
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(slug ? { slug } : { invoiceId }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      if (data?.code === "EMAIL_REQUIRED") {
        setMissingEmail(true);
        return null;
      }
      throw new Error(data?.error ?? "주문 생성에 실패했습니다.");
    }
    return data as CreatedOrder;
  }

  async function handlePay() {
    const storeId = process.env.NEXT_PUBLIC_PORTONE_STORE_ID;
    const channelKey = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY;
    if (!storeId || !channelKey) {
      setError("결제 설정이 완료되지 않았습니다. 관리자에게 문의해 주세요.");
      return;
    }

    setPaying(true);
    try {
      const order = await createOrder();
      if (!order) {
        setPaying(false);
        return;
      }

      const response = await PortOne.requestPayment({
        storeId,
        channelKey,
        // 포트원 paymentId로 주문번호를 그대로 사용해 서버에서 주문을 역조회한다
        paymentId: order.orderId,
        orderName: order.orderName,
        // 표시용 금액일 뿐, 실제 결제 금액은 서버가 포트원 조회로 주문 금액과 대조한다
        totalAmount: order.amount,
        currency: "KRW",
        payMethod: "CARD",
        customer: {
          fullName: order.customerName,
          phoneNumber: order.customerPhone,
          // 이니시스 V2 등 일부 PG는 구매자 이메일이 필수
          email: order.customerEmail,
        },
        // 모바일 등 리디렉션 방식일 때 결제창이 돌아올 주소
        redirectUrl: `${window.location.origin}/checkout/success`,
      });

      // 리디렉션 방식이면 여기 도달하지 않고 redirectUrl로 이동한다
      if (!response || response.code !== undefined) {
        // 사용자가 결제창을 닫은 경우 등 — 주문은 결제 대기로 남았다가 자동 만료된다
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

  if (missingEmail) {
    return (
      <div className="rounded-2xl border border-accent-2/40 bg-surface p-8 text-center">
        <p className="text-sm leading-relaxed text-muted">
          결제사 요건상 구매자 이메일이 필요합니다.
          <br />
          마이페이지에서 이메일을 등록한 뒤 다시 결제해 주세요.
        </p>
        <Link
          href="/mypage"
          className="mt-5 inline-block rounded-lg bg-accent px-6 py-3 text-sm font-medium text-white transition hover:bg-accent/80"
        >
          마이페이지에서 이메일 등록
        </Link>
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
        {ready ? (paying ? "결제 진행 중..." : "결제하기") : "결제 준비 중..."}
      </button>
    </div>
  );
}
