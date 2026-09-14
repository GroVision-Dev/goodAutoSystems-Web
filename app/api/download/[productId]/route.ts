import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/** 구매(PAID)한 회원에게만 프로그램 설치 파일을 내려준다. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ productId: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { productId } = await params;
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product || !product.downloadFile) {
    return NextResponse.json(
      { error: "다운로드할 수 없는 상품입니다." },
      { status: 404 }
    );
  }

  const paid = await prisma.order.findFirst({
    where: { userId: session.user.id, productId, status: "PAID" },
  });
  if (!paid) {
    return NextResponse.json(
      { error: "구매한 회원만 다운로드할 수 있습니다." },
      { status: 403 }
    );
  }

  // 경로 조작 방지: 파일명만 취해 private-files 내부로 한정, 헤더 주입 방지를 위해 허용 문자만 남긴다
  const safeName = path.basename(product.downloadFile);
  if (!/^[A-Za-z0-9._-]{1,200}$/.test(safeName) || safeName.startsWith(".")) {
    return NextResponse.json(
      { error: "파일을 찾을 수 없습니다. 고객센터에 문의해 주세요." },
      { status: 404 }
    );
  }
  const filePath = path.join(process.cwd(), "private-files", safeName);

  try {
    const file = await fs.readFile(filePath);
    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${safeName}"`,
        "Content-Length": String(file.length),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "파일을 찾을 수 없습니다. 고객센터에 문의해 주세요." },
      { status: 500 }
    );
  }
}
