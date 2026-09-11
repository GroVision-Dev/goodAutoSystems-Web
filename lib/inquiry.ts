import { z } from "zod";
import { phoneSchema } from "@/lib/validators";

/** 도입 문의 공통 유틸 (검증 스키마 · 상태 라벨) */

export const INQUIRY_STATUS: Record<string, { label: string; className: string }> = {
  NEW: { label: "신규", className: "bg-accent-2/15 text-accent-2" },
  IN_PROGRESS: { label: "진행 중", className: "bg-yellow-500/15 text-yellow-400" },
  DONE: { label: "처리 완료", className: "bg-muted/15 text-muted" },
};

export const INQUIRY_MESSAGE_MIN = 10;
export const INQUIRY_MESSAGE_MAX = 2000;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));

export const inquirySchema = z.object({
  name: z.string().trim().min(2, "이름은 2자 이상 입력해 주세요.").max(40, "이름은 40자 이내로 입력해 주세요."),
  phone: phoneSchema,
  email: z
    .string()
    .trim()
    .toLowerCase()
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
      message: "이메일 형식이 올바르지 않습니다.",
    }),
  company: optionalText(60),
  productSlug: optionalText(60),
  message: z
    .string()
    .trim()
    .min(INQUIRY_MESSAGE_MIN, `문의 내용을 ${INQUIRY_MESSAGE_MIN}자 이상 입력해 주세요.`)
    .max(INQUIRY_MESSAGE_MAX, `문의 내용은 ${INQUIRY_MESSAGE_MAX}자 이내로 입력해 주세요.`),
  agree: z.boolean().refine((v) => v === true, "개인정보 수집·이용에 동의해 주세요."),
  /** 봇 방지용 숨김 필드 — 값이 있으면 스팸으로 본다 */
  website: z.string().optional(),
});

export type InquiryInput = z.infer<typeof inquirySchema>;

/** 관리자 알림 문자 본문 (단문 범위 유지) */
export function inquiryAdminSmsText(input: {
  name: string;
  phone: string;
  productName?: string | null;
}): string {
  const product = input.productName ? ` · ${input.productName}` : "";
  return `[Optix] 새 도입 문의: ${input.name} ${formatPhoneForSms(input.phone)}${product}. 관리자 > 문의 관리에서 확인`;
}

function formatPhoneForSms(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  return digits;
}

/** IP 뒷자리 마스킹 (예: 211.234.xx.xx) */
export function maskIp(ip: string): string | null {
  if (!ip || ip === "unknown") return null;
  const parts = ip.split(".");
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.xx.xx`;
  // IPv6는 앞 두 블록만 (::1 같은 로컬 주소는 표시하지 않음)
  const v6 = ip.split(":");
  if (v6.length > 2 && v6[0] && v6[1]) return `${v6[0]}:${v6[1]}:…`;
  return null;
}
