import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "로그인" };

export default function LoginPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col justify-center px-4 py-12 md:py-24">
      <div className="rounded-2xl border border-line bg-surface p-6 md:p-8">
        <h1 className="mb-2 text-2xl font-bold">로그인</h1>
        <p className="mb-8 text-sm text-muted">
          Optix 계정으로 로그인하세요. 프로그램 로그인에도 동일한 계정을 사용합니다.
        </p>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
