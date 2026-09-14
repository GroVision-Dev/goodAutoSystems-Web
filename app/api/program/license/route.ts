import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateProgramRequest } from "@/lib/program-auth";

/** 프로그램 사용권 확인: 해당 상품을 결제(PAID)한 계정인지 검사 */
export async function GET(request: Request) {
  const result = await authenticateProgramRequest(request);
  if ("response" in result) return result.response;
  const { user } = result;

  const slug = new URL(request.url).searchParams.get("product");
  if (!slug || slug.length > 100) {
    return NextResponse.json(
      { error: "product 파라미터가 필요합니다." },
      { status: 400 }
    );
  }

  const product = await prisma.product.findUnique({ where: { slug } });
  if (!product) {
    return NextResponse.json({ error: "존재하지 않는 상품입니다." }, { status: 404 });
  }

  const paid = await prisma.order.findFirst({
    where: { userId: user.id, productId: product.id, status: "PAID" },
  });

  return NextResponse.json({
    licensed: Boolean(paid),
    product: product.slug,
    expiresAt: null, // 단건 구매는 영구 사용권
  });
}
