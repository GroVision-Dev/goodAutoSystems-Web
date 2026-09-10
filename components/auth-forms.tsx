"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";

const inputClass =
  "w-full rounded-lg border border-line bg-surface-2 px-4 py-3 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none";
const sideButtonClass =
  "shrink-0 whitespace-nowrap rounded-lg border border-accent/60 px-3 py-3 text-sm font-medium text-accent transition hover:bg-accent/10 disabled:opacity-50 sm:px-4";

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
      username: form.get("username"),
      password: form.get("password"),
      redirect: false,
    });
    setLoading(false);
    if (result?.error) {
      setError("아이디 또는 비밀번호가 올바르지 않거나 정지된 계정입니다.");
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <input
        name="username"
        type="text"
        autoComplete="username"
        autoCapitalize="none"
        required
        placeholder="아이디"
        className={inputClass}
      />
      <input
        name="password"
        type="password"
        autoComplete="current-password"
        required
        placeholder="비밀번호"
        className={inputClass}
      />
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

type UsernameStatus = "idle" | "checking" | "available" | "unavailable";

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 아이디 중복확인
  const [username, setUsername] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle");
  const [usernameMessage, setUsernameMessage] = useState<string | null>(null);

  // 휴대폰 인증
  const [sending, setSending] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  /** 인증번호 남은 유효시간(초) */
  const [expiresIn, setExpiresIn] = useState(0);

  function startExpiry(seconds: number) {
    setExpiresIn(seconds);
    const timer = setInterval(() => {
      setExpiresIn((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

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

  function handleUsernameChange(e: React.ChangeEvent<HTMLInputElement>) {
    setUsername(e.target.value);
    // 값이 바뀌면 이전 확인 결과는 무효
    setUsernameStatus("idle");
    setUsernameMessage(null);
  }

  async function handleCheckUsername() {
    setError(null);
    const value = username.trim().toLowerCase();
    if (!value) {
      setUsernameStatus("unavailable");
      setUsernameMessage("아이디를 입력해 주세요.");
      return;
    }

    setUsernameStatus("checking");
    const res = await fetch("/api/auth/check-username", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: value }),
    });
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      setUsernameStatus("unavailable");
      setUsernameMessage(data?.error ?? "아이디를 확인하지 못했습니다.");
      return;
    }
    if (data?.available) {
      setUsername(value);
      setUsernameStatus("available");
      setUsernameMessage("사용 가능한 아이디입니다.");
    } else {
      setUsernameStatus("unavailable");
      setUsernameMessage("이미 사용 중인 아이디입니다.");
    }
  }

  async function handleSendCode(e: React.MouseEvent<HTMLButtonElement>) {
    const form = e.currentTarget.closest("form");
    const phone = (form?.elements.namedItem("phone") as HTMLInputElement)?.value;
    setError(null);
    setNotice(null);

    if (!phone || phone.replace(/\D/g, "").length < 10) {
      setError("휴대폰 번호를 먼저 입력해 주세요.");
      return;
    }

    setSending(true);
    const res = await fetch("/api/auth/send-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    setSending(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "인증번호 발송에 실패했습니다.");
      return;
    }

    const data = await res.json().catch(() => null);
    const ttlMinutes: number = data?.ttlMinutes ?? 10;
    setCodeSent(true);
    setNotice(
      data?.devMode
        ? `개발 모드: SOLAPI가 설정되지 않아 문자 대신 서버 콘솔에 인증번호가 출력됩니다. (${ttlMinutes}분 유효)`
        : `인증번호를 문자로 발송했습니다. ${ttlMinutes}분 안에 입력해 주세요.`
    );
    startCooldown(data?.resendSeconds ?? 60);
    startExpiry(ttlMinutes * 60);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = new FormData(e.currentTarget);
    const name = form.get("name") as string;
    const email = form.get("email") as string;
    const phone = form.get("phone") as string;
    const password = form.get("password") as string;
    const passwordConfirm = form.get("passwordConfirm") as string;
    const code = form.get("code") as string;

    if (usernameStatus !== "available") {
      setError("아이디 중복확인을 해 주세요.");
      return;
    }
    if (password !== passwordConfirm) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }
    if (!code) {
      setError("문자로 받은 인증번호를 입력해 주세요.");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, name, email, phone, password, code }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "회원가입에 실패했습니다.");
      setLoading(false);
      return;
    }

    await signIn("credentials", { username, password, redirect: false });
    setLoading(false);
    router.push("/mypage");
    router.refresh();
  }

  const canSubmit = usernameStatus === "available" && codeSent && !loading;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <div className="flex gap-2">
          <input
            name="username"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            required
            minLength={4}
            maxLength={20}
            value={username}
            onChange={handleUsernameChange}
            placeholder="아이디 (영문 소문자·숫자 4~20자)"
            className={`${inputClass} min-w-0`}
          />
          <button
            type="button"
            onClick={handleCheckUsername}
            disabled={usernameStatus === "checking" || usernameStatus === "available"}
            className={sideButtonClass}
          >
            {usernameStatus === "checking"
              ? "확인 중..."
              : usernameStatus === "available"
                ? "확인 완료"
                : "중복확인"}
          </button>
        </div>
        {usernameMessage && (
          <p
            className={`mt-2 text-xs ${
              usernameStatus === "available" ? "text-accent" : "text-red-400"
            }`}
          >
            {usernameMessage}
          </p>
        )}
      </div>

      <input
        name="name"
        type="text"
        autoComplete="name"
        required
        placeholder="이름"
        className={inputClass}
      />

      <input
        name="email"
        type="email"
        autoComplete="email"
        autoCapitalize="none"
        required
        maxLength={254}
        placeholder="이메일 (결제 영수증 발송)"
        className={inputClass}
      />

      <div className="flex gap-2">
        <input
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required
          placeholder="휴대폰 번호 (010-0000-0000)"
          className={`${inputClass} min-w-0`}
        />
        <button
          type="button"
          onClick={handleSendCode}
          disabled={sending || cooldown > 0}
          className={sideButtonClass}
        >
          {sending
            ? "발송 중..."
            : cooldown > 0
              ? `재발송 (${cooldown}s)`
              : codeSent
                ? "재발송"
                : (
                    <>
                      <span className="sm:hidden">인증 발송</span>
                      <span className="hidden sm:inline">인증번호 발송</span>
                    </>
                  )}
        </button>
      </div>
      {codeSent && (
        <div className="relative">
          <input
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
            placeholder="인증번호 6자리"
            className={`${inputClass} w-full pr-24`}
          />
          <span
            className={`pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs ${
              expiresIn > 0 ? "text-muted" : "text-red-400"
            }`}
          >
            {expiresIn > 0
              ? `유효 ${Math.floor(expiresIn / 60)}:${String(expiresIn % 60).padStart(2, "0")}`
              : "만료됨 · 재발송 필요"}
          </span>
        </div>
      )}
      {notice && <p className="text-sm text-accent">{notice}</p>}

      <input
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        placeholder="비밀번호 (8자 이상)"
        className={inputClass}
      />
      <input
        name="passwordConfirm"
        type="password"
        autoComplete="new-password"
        required
        placeholder="비밀번호 확인"
        className={inputClass}
      />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={!canSubmit}
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
