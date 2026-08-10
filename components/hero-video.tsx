"use client";

import { useState } from "react";

/**
 * 랜딩 히어로 배경 영상.
 * 실제 회사/제품 소개 영상이 준비되면 public/videos/intro-placeholder.mp4 를
 * 교체하거나 src를 변경하면 됩니다. 영상 로드 실패 시 애니메이션 그라데이션으로 대체됩니다.
 */
export default function HeroVideo() {
  const [failed, setFailed] = useState(false);

  return (
    <div className="absolute inset-0 overflow-hidden">
      {!failed ? (
        <video
          className="h-full w-full object-cover opacity-40"
          src="/videos/intro-placeholder.mp4"
          autoPlay
          muted
          loop
          playsInline
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="h-full w-full animate-pulse bg-gradient-to-br from-accent/30 via-surface-2 to-accent-2/20" />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/60 to-background" />
    </div>
  );
}
