import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractBearerToken, verifyProgramToken } from "@/lib/program-jwt";

/** 프로그램 사용권 확인: 해당 상품을 결제(PAID)한 계정인지 검사 */
export async function GET(request: Request) {
  const token = extractBearerToken(request);
  const payload = token ? await verifyProgramToken(token) : null;
  if (!payload) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) {
    return NextResponse.json({ error: "존재하지 않는 계정입니다." }, { status: 401 });
  }
  if (user.status === "SUSPENDED") {
    return NextResponse.json({ error: "정지된 계정입니다." }, { status: 403 });
  }

  const slug = new URL(request.url).searchParams.get("product");
  if (!slug) {
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
