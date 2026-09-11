"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * 접속 통계용 페이지 조회 기록.
 * 경로가 바뀔 때마다 /api/track 에 전송한다. 실패는 무시한다.
 */
export default function PageViewTracker() {
  const pathname = usePathname();
  const lastSent = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || lastSent.current === pathname) return;
    lastSent.current = pathname;

    const body = JSON.stringify({
      path: pathname,
      referrer: document.referrer || undefined,
    });
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  }, [pathname]);

  return null;
}
