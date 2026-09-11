"use client";

import { useState } from "react";
import Link from "next/link";
import { INQUIRY_MESSAGE_MAX } from "@/lib/inquiry";

export interface InquiryProductOption {
  slug: string;
  name: string;
}

const inputClass =
  "w-full rounded-lg border border-line bg-surface-2 px-4 py-3 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none";

/**
 * 도입 문의 폼. 홈 문의 섹션과 /contact 페이지에서 공용.
 * 접수되면 /api/inquiries에 저장되고 관리자 문의 관리에 표시된다.
 */
export default function InquiryForm({
  products,
  defaultProductSlug,
}: {
  products: InquiryProductOption[];
  defaultProductSlug?: string;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [messageLength, setMessageLength] = useState(0);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const data = new FormData(form);

    setSubmitting(true);
    try {
      const res = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"),
          phone: data.get("phone"),
          email: data.get("email"),
          company: data.get("company"),
          productSlug: data.get("productSlug"),
          message: data.get("message"),
          agree: data.get("agree") === "on",
          website: data.get("website"),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "문의 접수에 실패했습니다. 잠시 후 다시 시도해 주세요.");
      }
      setDone(true);
      form.reset();
      setMessageLength(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "문의 접수에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-accent/40 bg-accent/5 p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent/15 text-2xl text-accent">
          ✓
        </div>
        <p className="mt-4 font-bold">문의가 접수되었습니다</p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          영업일 기준 1일 내에 남겨주신 연락처로 회신드립니다.
        </p>
        <button
          type="button"
          onClick={() => setDone(false)}
          className="mt-6 rounded-lg border border-line px-5 py-2 text-sm text-muted transition hover:text-foreground"
        >
          추가 문의 남기기
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-left">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-muted">
            이름 <span className="text-red-400">*</span>
          </span>
          <input name="name" required minLength={2} maxLength={40} autoComplete="name" placeholder="홍길동" className={inputClass} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-muted">
            휴대폰 번호 <span className="text-red-400">*</span>
          </span>
          <input
            name="phone"
            type="tel"
            inputMode="tel"
            required
            autoComplete="tel"
            placeholder="010-0000-0000"
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-muted">이메일 (선택)</span>
          <input name="email" type="email" autoComplete="email" placeholder="name@company.com" className={inputClass} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-muted">회사명 (선택)</span>
          <input name="company" maxLength={60} autoComplete="organization" placeholder="회사 또는 팀 이름" className={inputClass} />
        </label>
      </div>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-muted">관심 상품 (선택)</span>
        <select name="productSlug" defaultValue={defaultProductSlug ?? ""} className={inputClass}>
          <option value="">아직 정하지 않았어요</option>
          {products.map((p) => (
            <option key={p.slug} value={p.slug}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="flex items-center justify-between text-muted">
          <span>
            문의 내용 <span className="text-red-400">*</span>
          </span>
          <span className="text-xs">
            {messageLength}/{INQUIRY_MESSAGE_MAX}
          </span>
        </span>
        <textarea
          name="message"
          required
          minLength={10}
          maxLength={INQUIRY_MESSAGE_MAX}
          rows={5}
          onChange={(e) => setMessageLength(e.target.value.length)}
          placeholder="자동화하고 싶은 업무, 현재 사용하는 프로그램, 반복 작업에 드는 시간 등을 적어주시면 더 정확히 안내드릴 수 있습니다."
          className={`${inputClass} resize-y`}
        />
      </label>

      {/* 봇 방지용 숨김 필드 — 사람은 채우지 않는다 */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        className="absolute -left-[9999px] h-0 w-0 opacity-0"
      />

      <label className="flex items-start gap-2.5 text-xs leading-relaxed text-muted">
        <input type="checkbox" name="agree" required className="mt-0.5 h-4 w-4 shrink-0 accent-accent" />
        <span>
          문의 답변을 위한 개인정보(이름, 연락처, 이메일, 회사명, 문의 내용) 수집·이용에 동의합니다.
          답변 완료 후 1년간 보관 후 파기하며, 자세한 내용은{" "}
          <Link href="/privacy" className="underline hover:text-foreground">
            개인정보처리방침
          </Link>
          을 확인해 주세요. <span className="text-red-400">*</span>
        </span>
      </label>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-accent px-8 py-3.5 font-medium text-white transition hover:bg-accent/80 disabled:opacity-50"
      >
        {submitting ? "접수 중..." : "문의 남기기"}
      </button>
    </form>
  );
}
