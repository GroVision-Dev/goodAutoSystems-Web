import { expireStalePendingOrders } from "@/lib/order-expiry";
import { runRetentionCleanup } from "@/lib/retention";

/**
 * 서버 프로세스 안에서 도는 정기 작업 (instrumentation.ts에서 기동).
 * - 결제 대기(PENDING) 주문 자동 만료
 * - 보유 기간이 지난 개인정보·접속기록 파기
 * 단일 컨테이너 운영 기준. 실패해도 다음 주기에 다시 시도한다.
 */

const ORDER_EXPIRY_INTERVAL_MS = 10 * 60 * 1000;
const RETENTION_INTERVAL_MS = 6 * 60 * 60 * 1000;
/** 서버 기동 직후 DB 연결이 준비될 시간을 둔다 */
const STARTUP_DELAY_MS = 60 * 1000;

const globalForMaintenance = globalThis as unknown as { maintenanceStarted?: boolean };

async function runOrderExpiry() {
  try {
    const expired = await expireStalePendingOrders();
    if (expired > 0) console.info(`[maintenance] 결제 대기 주문 ${expired}건 만료`);
  } catch (e) {
    console.error("[maintenance] 주문 만료 처리 실패", e);
  }
}

async function runRetention() {
  try {
    const result = await runRetentionCleanup();
    const total = Object.values(result).reduce((sum, count) => sum + count, 0);
    if (total > 0) console.info("[maintenance] 보유기간 경과 데이터 파기", result);
  } catch (e) {
    console.error("[maintenance] 보유기간 파기 실패", e);
  }
}

export function startMaintenanceJobs() {
  // 개발 서버 핫리로드로 중복 기동되지 않게 한다
  if (globalForMaintenance.maintenanceStarted) return;
  globalForMaintenance.maintenanceStarted = true;

  setTimeout(() => {
    void runOrderExpiry();
    void runRetention();
    setInterval(() => void runOrderExpiry(), ORDER_EXPIRY_INTERVAL_MS).unref();
    setInterval(() => void runRetention(), RETENTION_INTERVAL_MS).unref();
  }, STARTUP_DELAY_MS).unref();
}
