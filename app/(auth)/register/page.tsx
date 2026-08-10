import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "회원가입" };

export default function RegisterPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col justify-center px-4 py-24">
      <div className="rounded-2xl border border-line bg-surface p-8">
        <h1 className="mb-2 text-2xl font-bold">회원가입</h1>
        <p className="mb-8 text-sm text-muted">
          가입 후 상품 구매와 프로그램 다운로드를 이용할 수 있습니다.
        </p>
        <RegisterForm />
      </div>
    </div>
  );
}
