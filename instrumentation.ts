/** 서버 인스턴스 기동 시 1회 실행 — Node.js 런타임에서만 정기 작업을 시작한다 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startMaintenanceJobs } = await import("@/lib/maintenance");
  startMaintenanceJobs();
}
