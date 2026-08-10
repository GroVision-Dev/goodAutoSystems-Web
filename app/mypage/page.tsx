import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

export const metadata: Metadata = { title: "마이페이지" };

export default async function MyPage() {
  const session = await auth();
  if (!session) redirect("/login?callbackUrl=/mypage");

  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <h1 className="text-2xl font-bold">마이페이지</h1>
      <p className="mt-2 text-muted">{session.user.name}님, 환영합니다.</p>
    </div>
  );
}
