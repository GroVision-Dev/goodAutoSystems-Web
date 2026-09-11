import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { randomUUID } from "crypto";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  VISITOR_COOKIE,
  VISITOR_COOKIE_MAX_AGE,
  isBotUserAgent,
  maskIp,
  normalizePath,
  shouldTrackPath,
  truncateUserAgent,
} from "@/lib/analytics";

const trackSchema = z.object({
  path: z.string().min(1).max(2000),
  referrer: z.string().max(2000).optional(),
});

/**
 * 페이지 조회 기록.
 * 클라이언트(PageViewTracker)가 경로 변경마다 호출한다.
 * 봇·관리자 경로·API 경로는 기록하지 않으며, 실패해도 사용자 화면에는 영향이 없도록 항상 204를 돌려준다.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = trackSchema.safeParse(body);
  if (!parsed.success) return new NextResponse(null, { status: 204 });

  const path = normalizePath(parsed.data.path);
  if (!shouldTrackPath(path)) return new NextResponse(null, { status: 204 });

  const headerStore = await headers();
  const userAgent = headerStore.get("user-agent");
  if (isBotUserAgent(userAgent)) return new NextResponse(null, { status: 204 });

  const cookieStore = await cookies();
  let visitorId = cookieStore.get(VISITOR_COOKIE)?.value;
  const isNewVisitor = !visitorId || !/^[a-f0-9-]{36}$/i.test(visitorId);
  if (isNewVisitor) visitorId = randomUUID();

  const session = await auth().catch(() => null);
  const ipMasked = maskIp(
    headerStore.get("x-forwarded-for") ?? headerStore.get("x-real-ip"),
  );

  // 외부 유입만 기록 (자기 사이트 내 이동은 제외)
  let referrer: string | null = null;
  if (parsed.data.referrer) {
    try {
      const ref = new URL(parsed.data.referrer);
      const host = headerStore.get("host");
      if (host && ref.host !== host) referrer = ref.origin.slice(0, 200);
    } catch {
      referrer = null;
    }
  }

  try {
    await prisma.pageView.create({
      data: {
        path,
        userId: session?.user.id ?? null,
        visitorId: visitorId!,
        ipMasked,
        userAgent: truncateUserAgent(userAgent),
        referrer,
      },
    });
  } catch (e) {
    console.error("[track] 기록 실패", e);
  }

  const response = new NextResponse(null, { status: 204 });
  if (isNewVisitor) {
    response.cookies.set(VISITOR_COOKIE, visitorId!, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: VISITOR_COOKIE_MAX_AGE,
      path: "/",
    });
  }
  return response;
}
