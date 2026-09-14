"use client";

import { useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { PASSWORD_PLACEHOLDER, passwordPolicyError } from "@/lib/validators";

const inputClass =
  "w-full rounded-lg border border-line bg-surface-2 px-4 py-3 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none";
const sideButtonClass =
  "shrink-0 whitespace-nowrap rounded-lg border border-accent/60 px-3 py-3 text-sm font-medium text-accent transition hover:bg-accent/10 disabled:opacity-50 sm:px-4";

/** 로그인 후 이동 경로는 사이트 내부 경로만 허용한다 (외부 주소로 보내는 오픈 리다이렉트 방지) */
function safeCallbackUrl(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return "/mypage";
  }
  return value;
}

/** 서버 오류 코드 → 안내 문구. 아이디 존재 여부를 알 수 없도록 실패 사유를 뭉뚱그린다 */
function loginErrorMessage(code: string | undefined): string {
  switch (code) {
    case "rate_limited":
      return "로그인 시도가 너무 많습니다. 15분 후 다시 시도해 주세요.";
    case "otp_expired":
      return "인증번호가 만료되었거나 입력 횟수를 초과했습니다. 처음부터 다시 로그인해 주세요.";
    case "otp_send_failed":
      return "인증번호 문자를 보내지 못했습니다. 잠시 후 다시 시도하거나 운영 담당자에게 문의해 주세요.";
    default:
      return "아이디 또는 비밀번호가 올바르지 않거나 이용할 수 없는 계정입니다.";
  }
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = safeCallbackUrl(searchParams.get("callbackUrl"));
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  /** 관리자 2단계 인증 입력 단계 */
  const [otpStep, setOtpStep] = useState(false);
  const credentialsRef = useRef<{ username: string; password: string } | null>(null);

  async function attempt(credentials: { username: string; password: string; otp?: string }) {
    setLoading(true);
    try {
      return await signIn("credentials", { ...credentials, redirect: false });
    } finally {
      setLoading(false);
    }
  }

  function finish() {
    credentialsRef.current = null;
    router.push(callbackUrl);
    router.refresh();
  }

  function backToStart(message: string | null) {
    credentialsRef.current = null;
    setOtpStep(false);
    setNotice(null);
    setError(message);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    const form = new FormData(e.currentTarget);
    const username = String(form.get("username") ?? "");
    const password = String(form.get("password") ?? "");

    const result = await attempt({ username, password });
    if (result?.code === "otp_required") {
      credentialsRef.current = { username, password };
      setOtpStep(true);
      setNotice("관리자 계정은 2단계 인증이 필요합니다. 등록된 휴대폰으로 받은 인증번호 6자리를 입력하세요.");
      return;
    }
    if (result?.error) {
      setError(loginErrorMessage(result.code));
      return;
    }
    finish();
  }

  async function handleOtpSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const credentials = credentialsRef.current;
    if (!credentials) return backToStart(null);
    const otp = String(new FormData(e.currentTarget).get("otp") ?? "").trim();
    if (!/^\d{6}$/.test(otp)) {
      setError("인증번호 6자리를 입력해 주세요.");
      return;
    }

    const result = await attempt({ ...credentials, otp });
    if (result?.error) {
      if (result.code === "otp_invalid") {
        setError("인증번호가 올바르지 않습니다.");
        return;
      }
      return backToStart(loginErrorMessage(result.code));
    }
    finish();
  }

  async function handleResend() {
    const credentials = credentialsRef.current;
    if (!credentials) return backToStart(null);
    setError(null);
    const result = await attempt(credentials);
    if (result?.code === "otp_required") {
      setNotice("인증번호를 다시 요청했습니다. 재발송은 60초 간격으로 가능합니다.");
      return;
    }
    backToStart(loginErrorMessage(result?.code));
  }

  if (otpStep) {
    return (
      <form onSubmit={handleOtpSubmit} className="flex flex-col gap-4">
        {notice && <p className="text-sm text-accent">{notice}</p>}
        <input
          name="otp"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          required
          autoFocus
          placeholder="인증번호 6자리"
          className={inputClass}
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-accent py-3 font-medium text-white transition hover:bg-accent/80 disabled:opacity-50"
        >
          {loading ? "확인 중..." : "인증하고 로그인"}
        </button>
        <div className="flex justify-between text-sm text-muted">
          <button type="button" onClick={handleResend} disabled={loading} className="hover:text-foreground">
            인증번호 다시 받기
          </button>
          <button type="button" onClick={() => backToStart(null)} className="hover:text-foreground">
            처음으로
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <input
        name="username"
        type="text"
        autoComplete="username"
        autoCapitalize="none"
        required
        maxLength={50}
        placeholder="아이디"
        className={inputClass}
      />
      <input
        name="password"
        type="password"
        autoComplete="current-password"
        required
        maxLength={200}
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
    const agreeTerms = form.get("agreeTerms") === "on";
    const agreePrivacy = form.get("agreePrivacy") === "on";

    if (usernameStatus !== "available") {
      setError("아이디 중복확인을 해 주세요.");
      return;
    }
    const policyError = passwordPolicyError(password, username);
    if (policyError) {
      setError(policyError);
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
    if (!agreeTerms || !agreePrivacy) {
      setError("필수 약관에 동의해 주세요.");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, name, email, phone, password, code, agreeTerms, agreePrivacy }),
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
        maxLength={40}
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
        maxLength={72}
        placeholder={PASSWORD_PLACEHOLDER}
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

      <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface-2/60 p-4 text-xs leading-relaxed text-muted">
        <label className="flex items-start gap-2.5">
          <input type="checkbox" name="agreeTerms" required className="mt-0.5 h-4 w-4 shrink-0 accent-accent" />
          <span>
            <span className="text-red-400">[필수]</span>{" "}
            <Link href="/terms" target="_blank" className="underline hover:text-foreground">
              이용약관
            </Link>
            에 동의합니다.
          </span>
        </label>
        <label className="flex items-start gap-2.5">
          <input type="checkbox" name="agreePrivacy" required className="mt-0.5 h-4 w-4 shrink-0 accent-accent" />
          <span>
            <span className="text-red-400">[필수]</span> 개인정보 수집·이용에 동의합니다.
            <span className="mt-1 block">
              수집 항목: 아이디, 이름, 이메일, 휴대폰 번호, 비밀번호(암호화 저장) · 목적: 회원 식별·로그인,
              상품 결제·제공, 고객 상담 · 보유 기간: 회원 탈퇴 시까지(거래 기록은 관계 법령에 따라 5년).
              동의를 거부할 수 있으며, 거부 시 회원가입이 제한됩니다. 자세한 내용은{" "}
              <Link href="/privacy" target="_blank" className="underline hover:text-foreground">
                개인정보처리방침
              </Link>
              을 확인해 주세요.
            </span>
          </span>
        </label>
      </div>

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
