import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { invoiceOrderName } from "@/lib/billing";
import { checkRateLimit } from "@/lib/rate-limit";
import { expireStalePendingOrders } from "@/lib/order-expiry";
import { newOrderId } from "@/lib/order-id";

const createOrderSchema = z.union([
  z.object({ slug: z.string().min(1).max(100), dryRun: z.boolean().optional() }),
  z.object({ invoiceId: z.string().min(1).max(100), dryRun: z.boolean().optional() }),
]);

/** 회원당 주문 생성 한도 (결제창 반복 열기로 주문이 쌓이는 것 방지) */
const ORDER_LIMIT = 10;
const ORDER_WINDOW_MS = 10 * 60 * 1000;

/**
 * 결제 시작 시 PENDING 주문 생성. 금액은 서버의 상품 가격·청구서 금액으로 확정한다.
 * dryRun이면 주문을 만들지 않고 결제 가능 여부(이메일 등록 등)만 확인한다 — 결제 화면 진입 시 사용.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  // 결제창 고객정보용 휴대폰 번호·이메일 (세션에는 넣지 않고 매번 조회)
  // 이메일은 이니시스 V2 등 일부 PG에서 필수라 결제 화면에서 입력받아 채운다
  const customer = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { phone: true, email: true },
  });
  if (!customer) {
    return NextResponse.json({ error: "계정을 찾을 수 없습니다." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  let target: { productId?: string; invoiceId?: string; amount: number; orderName: string };

  if ("invoiceId" in parsed.data) {
    // 월 청구서 결제
    const invoice = await prisma.invoice.findUnique({
      where: { id: parsed.data.invoiceId },
    });
    if (!invoice || invoice.userId !== session.user.id) {
      return NextResponse.json({ error: "청구서를 찾을 수 없습니다." }, { status: 404 });
    }
    if (invoice.status !== "UNPAID") {
      return NextResponse.json(
        { error: invoice.status === "PAID" ? "이미 납부한 청구서입니다." : "취소된 청구서입니다." },
        { status: 409 }
      );
    }
    target = {
      invoiceId: invoice.id,
      amount: invoice.amount,
      orderName: invoiceOrderName(invoice.title, invoice.billingMonth),
    };
  } else {
    const product = await prisma.product.findUnique({
      where: { slug: parsed.data.slug },
    });
    if (!product || !product.isActive) {
      return NextResponse.json({ error: "상품을 찾을 수 없습니다." }, { status: 404 });
    }

    // 1회 결제 상품(영구 사용권)은 중복 구매를 막는다. 월 결제 상품은 첫 달 결제를 다시 시작할 수 있다.
    if (product.billingType === "ONE_TIME") {
      const alreadyPaid = await prisma.order.findFirst({
        where: { userId: session.user.id, productId: product.id, status: "PAID" },
        select: { id: true },
      });
      if (alreadyPaid) {
        return NextResponse.json({ error: "이미 구매한 상품입니다." }, { status: 409 });
      }
    }
    target = {
      productId: product.id,
      amount: product.price,
      orderName: product.billingType === "MONTHLY" ? `${product.name} 첫 달 이용료` : product.name,
    };
  }

  if (parsed.data.dryRun) {
    return NextResponse.json({ ready: true, hasEmail: Boolean(customer.email) });
  }

  if (!customer.email) {
    return NextResponse.json(
      { error: "결제사 요건상 구매자 이메일이 필요합니다.", code: "EMAIL_REQUIRED" },
      { status: 400 }
    );
  }

  const limit = checkRateLimit(`order:${session.user.id}`, ORDER_LIMIT, ORDER_WINDOW_MS);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "결제 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  await expireStalePendingOrders().catch((e) => console.error("[orders] 만료 주문 정리 실패", e));

  const orderId = newOrderId();
  await prisma.order.create({
    data: {
      userId: session.user.id,
      productId: target.productId,
      invoiceId: target.invoiceId,
      orderId,
      amount: target.amount,
      status: "PENDING",
    },
  });

  return NextResponse.json({
    orderId,
    amount: target.amount,
    orderName: target.orderName,
    customerName: session.user.name,
    customerPhone: customer.phone,
    customerEmail: customer.email,
  });
}
