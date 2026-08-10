"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";

const inputClass =
  "w-full rounded-lg border border-line bg-surface-2 px-4 py-3 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/mypage";
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const result = await signIn("credentials", {
      email: form.get("email"),
      password: form.get("password"),
      redirect: false,
    });
    setLoading(false);
    if (result?.error) {
      setError("이메일 또는 비밀번호가 올바르지 않거나 정지된 계정입니다.");
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <input name="email" type="email" required placeholder="이메일" className={inputClass} />
      <input name="password" type="password" required placeholder="비밀번호" className={inputClass} />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-accent py-3 font-medium text-white transition hover:bg-accent/80 disabled:opacity-50"
      >
        {loading ? "로그인 중..." : "로그인"}
      </button>
      <p className="text-center text-sm text-muted">
        아직 계정이 없으신가요?{" "}
        <Link href="/register" className="text-accent hover:underline">
          회원가입
        </Link>
      </p>
    </form>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  function startCooldown(seconds: number) {
    setCooldown(seconds);
    const timer = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  async function handleSendCode(e: React.MouseEvent<HTMLButtonElement>) {
    const form = e.currentTarget.closest("form");
    const email = (form?.elements.namedItem("email") as HTMLInputElement)?.value;
    setError(null);
    setNotice(null);

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      setError("이메일을 먼저 입력해 주세요.");
      return;
    }

    setSending(true);
    const res = await fetch("/api/auth/send-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setSending(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "인증코드 발송에 실패했습니다.");
      return;
    }

    setCodeSent(true);
    setNotice("인증코드를 발송했습니다. 메일함(스팸함 포함)을 확인해 주세요.");
    startCooldown(60);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = new FormData(e.currentTarget);
    const email = form.get("email") as string;
    const password = form.get("password") as string;
    const passwordConfirm = form.get("passwordConfirm") as string;
    const name = form.get("name") as string;
    const code = form.get("code") as string;

    if (password !== passwordConfirm) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }
    if (!code) {
      setError("이메일로 받은 인증코드를 입력해 주세요.");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name, code }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "회원가입에 실패했습니다.");
      setLoading(false);
      return;
    }

    await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    router.push("/mypage");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <input name="name" type="text" required placeholder="이름" className={inputClass} />
      <div className="flex gap-2">
        <input
          name="email"
          type="email"
          required
          placeholder="이메일"
          className={inputClass}
        />
        <button
          type="button"
          onClick={handleSendCode}
          disabled={sending || cooldown > 0}
          className="shrink-0 rounded-lg border border-accent/60 px-4 py-3 text-sm font-medium text-accent transition hover:bg-accent/10 disabled:opacity-50"
        >
          {sending
            ? "발송 중..."
            : cooldown > 0
              ? `재발송 (${cooldown}s)`
              : codeSent
                ? "재발송"
                : "인증코드 발송"}
        </button>
      </div>
      {codeSent && (
        <input
          name="code"
          type="text"
          inputMode="numeric"
          maxLength={6}
          required
          placeholder="인증코드 6자리"
          className={inputClass}
        />
      )}
      {notice && <p className="text-sm text-accent">{notice}</p>}
      <input
        name="password"
        type="password"
        required
        minLength={8}
        placeholder="비밀번호 (8자 이상)"
        className={inputClass}
      />
      <input
        name="passwordConfirm"
        type="password"
        required
        placeholder="비밀번호 확인"
        className={inputClass}
      />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-accent py-3 font-medium text-white transition hover:bg-accent/80 disabled:opacity-50"
      >
        {loading ? "가입 중..." : "회원가입"}
      </button>
      <p className="text-center text-sm text-muted">
        이미 계정이 있으신가요?{" "}
        <Link href="/login" className="text-accent hover:underline">
          로그인
        </Link>
      </p>
    </form>
  );
}
