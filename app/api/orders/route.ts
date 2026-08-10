import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const createOrderSchema = z.object({ slug: z.string().min(1) });

/** 결제 시작 전 PENDING 주문 생성. 금액은 서버의 상품 가격으로 확정한다. */
export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
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

  const orderId = `GAS-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

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
    customerEmail: session.user.email,
  });
}
