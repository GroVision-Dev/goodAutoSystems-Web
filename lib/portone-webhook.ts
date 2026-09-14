import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * 포트원 V2 웹훅 서명 검증 (Standard Webhooks 규격, 포트원 server-sdk와 동일한 방식).
 * - 헤더: webhook-id / webhook-timestamp / webhook-signature
 * - 시크릿: "whsec_" 접두어(선택)를 떼고 base64 디코딩
 * - 서명: HMAC-SHA256(`${id}.${timestamp}.${rawBody}`) base64, 헤더는 "v1,<sig> v1,<sig>" 형식
 * - 타임스탬프: 현재 시각 ±5분 이내만 허용 (재전송 공격 방지)
 */

export const WEBHOOK_TOLERANCE_SECONDS = 5 * 60;

export type PortOneWebhookErrorReason =
  | "MISSING_REQUIRED_HEADERS"
  | "INVALID_TIMESTAMP"
  | "TIMESTAMP_TOO_OLD"
  | "TIMESTAMP_TOO_NEW"
  | "NO_MATCHING_SIGNATURE"
  | "INVALID_SECRET"
  | "INVALID_PAYLOAD";

export class PortOneWebhookError extends Error {
  constructor(public readonly reason: PortOneWebhookErrorReason) {
    super(`포트원 웹훅 검증 실패: ${reason}`);
    this.name = "PortOneWebhookError";
  }
}

/** 2024-04-25 버전 웹훅 본문 */
export interface PortOneWebhookPayload {
  type: string;
  timestamp?: string;
  data?: {
    paymentId?: string;
    storeId?: string;
    transactionId?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

type HeaderSource = { get(name: string): string | null } | Record<string, string | string[] | undefined>;

function readHeader(headers: HeaderSource, name: string): string | null {
  if (typeof (headers as { get?: unknown }).get === "function") {
    return (headers as { get(name: string): string | null }).get(name);
  }
  const record = headers as Record<string, string | string[] | undefined>;
  const key = Object.keys(record).find((k) => k.toLowerCase() === name);
  if (!key) return null;
  const value = record[key];
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function decodeSecret(secret: string): Buffer {
  const raw = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
  const decoded = Buffer.from(raw, "base64");
  if (!raw || decoded.length === 0) throw new PortOneWebhookError("INVALID_SECRET");
  return decoded;
}

/** 서명 생성 (테스트·검증 공용) */
export function signPortOneWebhook(secret: string, id: string, timestamp: string, body: string): string {
  return createHmac("sha256", decodeSecret(secret)).update(`${id}.${timestamp}.${body}`).digest("base64");
}

/** 서명이 올바르면 파싱한 본문을 돌려주고, 아니면 PortOneWebhookError를 던진다 */
export function verifyPortOneWebhook(
  secret: string,
  rawBody: string,
  headers: HeaderSource,
  now: Date = new Date()
): PortOneWebhookPayload {
  const id = readHeader(headers, "webhook-id");
  const timestamp = readHeader(headers, "webhook-timestamp");
  const signatureHeader = readHeader(headers, "webhook-signature");
  if (!id || !timestamp || !signatureHeader) {
    throw new PortOneWebhookError("MISSING_REQUIRED_HEADERS");
  }

  if (!/^\d+$/.test(timestamp)) throw new PortOneWebhookError("INVALID_TIMESTAMP");
  const nowSeconds = Math.floor(now.getTime() / 1000);
  const ts = Number(timestamp);
  if (nowSeconds - ts > WEBHOOK_TOLERANCE_SECONDS) throw new PortOneWebhookError("TIMESTAMP_TOO_OLD");
  if (ts - nowSeconds > WEBHOOK_TOLERANCE_SECONDS) throw new PortOneWebhookError("TIMESTAMP_TOO_NEW");

  const expected = Buffer.from(signPortOneWebhook(secret, id, timestamp, rawBody), "base64");

  const matched = signatureHeader.split(" ").some((versioned) => {
    const [version, signature] = versioned.split(",", 2);
    if (version !== "v1" || !signature) return false;
    const actual = Buffer.from(signature, "base64");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  });
  if (!matched) throw new PortOneWebhookError("NO_MATCHING_SIGNATURE");

  try {
    const payload = JSON.parse(rawBody) as PortOneWebhookPayload;
    if (!payload || typeof payload !== "object" || typeof payload.type !== "string") {
      throw new Error("invalid");
    }
    return payload;
  } catch {
    throw new PortOneWebhookError("INVALID_PAYLOAD");
  }
}
