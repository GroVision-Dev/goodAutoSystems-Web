import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { invoiceOrderName } from "@/lib/billing";

const createOrderSchema = z.union([
  z.object({ slug: z.string().min(1) }),
  z.object({ invoiceId: z.string().min(1) }),
]);

function newOrderId() {
  return `GAS-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 결제 시작 전 PENDING 주문 생성. 금액은 서버의 상품 가격으로 확정한다. */
export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  // 결제창 고객정보용 휴대폰 번호 (세션에는 넣지 않고 매번 조회)
  const customer = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { phone: true },
  });
  if (!customer) {
    return NextResponse.json({ error: "계정을 찾을 수 없습니다." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  // 월 청구서 결제
  if ("invoiceId" in parsed.data) {
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

    const orderId = newOrderId();
    const orderName = invoiceOrderName(invoice.title, invoice.billingMonth);
    await prisma.order.create({
      data: {
        userId: session.user.id,
        invoiceId: invoice.id,
        orderId,
        amount: invoice.amount,
        status: "PENDING",
      },
    });
    return NextResponse.json({
      orderId,
      amount: invoice.amount,
      orderName,
      customerName: session.user.name,
      customerPhone: customer.phone,
    });
  }

  const product = await prisma.product.findUnique({
    where: { slug: parsed.data.slug },
  });
  if (!product || !product.isActive) {
    return NextResponse.json({ error: "상품을 찾을 수 없습니다." }, { status: 404 });
  }

  const alreadyPaid = await prisma.order.findFirst({
    where: { userId: session.user.id, productId: product.id, status: "PAID" },
  });
  if (alreadyPaid) {
    return NextResponse.json(
      { error: "이미 구매한 상품입니다." },
      { status: 409 }
    );
  }

  const orderId = newOrderId();

  await prisma.order.create({
    data: {
      userId: session.user.id,
      productId: product.id,
      orderId,
      amount: product.price,
      status: "PENDING",
    },
  });

  return NextResponse.json({
    orderId,
    amount: product.price,
    orderName: product.name,
    customerName: session.user.name,
    customerPhone: customer.phone,
  });
}
