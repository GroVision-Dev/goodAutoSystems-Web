import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { inquirySchema, inquiryAdminSmsText, maskIp } from "@/lib/inquiry";
import { getSmsConfig, sendSms } from "@/lib/sms";
import { SITE_INFO } from "@/lib/site-config";

/** 스팸 방지: IP당 1시간 5건 */
const INQUIRY_IP_LIMIT = 5;
const INQUIRY_IP_WINDOW_MS = 60 * 60 * 1000;

/** 도입 문의 접수 (비회원도 가능). 관리자에게는 문자로 알린다 (SOLAPI 설정 시) */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = inquirySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "입력값이 올바르지 않습니다." },
      { status: 400 }
    );
  }

  // 숨김 필드에 값이 있으면 봇으로 보고 접수된 것처럼 응답만 한다
  if (parsed.data.website) {
    return NextResponse.json({ ok: true });
  }

  const ip = getClientIp(request);
  const limit = checkRateLimit(`inquiry:${ip}`, INQUIRY_IP_LIMIT, INQUIRY_IP_WINDOW_MS);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "문의가 너무 자주 접수되었습니다. 잠시 후 다시 시도해 주세요." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  const { name, phone, email, company, productSlug, message } = parsed.data;

  // 관심 상품은 실제 존재하는 슬러그만 저장한다
  const product = productSlug
    ? await prisma.product.findUnique({ where: { slug: productSlug }, select: { slug: true, name: true } })
    : null;

  const session = await auth().catch(() => null);

  const inquiry = await prisma.inquiry.create({
    data: {
      name,
      phone,
      email,
      company,
      productSlug: product?.slug ?? null,
      message,
      userId: session?.user.id ?? null,
      ipMasked: maskIp(ip),
    },
  });

  // 관리자 알림 문자 — 실패해도 접수는 성공으로 처리한다
  const smsConfig = getSmsConfig();
  const adminPhone = SITE_INFO.phone.replace(/\D/g, "");
  if (smsConfig && adminPhone) {
    try {
      await sendSms(
        adminPhone,
        inquiryAdminSmsText({ name, phone, productName: product?.name ?? null }),
        smsConfig
      );
    } catch (e) {
      console.error("[inquiry] 관리자 알림 문자 실패", inquiry.id, e);
    }
  } else {
    console.log(`[inquiry] 새 문의 접수 ${inquiry.id}: ${name} ${phone}${product ? ` · ${product.name}` : ""}`);
  }

  return NextResponse.json({ ok: true });
}
