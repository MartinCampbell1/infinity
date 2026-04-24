"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function RunLiveRefresh({
  enabled,
  intervalMs = 2500,
}: {
  enabled: boolean;
  intervalMs?: number;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      router.refresh();
    }, intervalMs);

    return () => window.clearInterval(interval);
  }, [enabled, intervalMs, router]);

  return (
    <span
      hidden
      data-run-live-refresh={enabled ? "active" : "idle"}
      data-run-live-refresh-interval-ms={intervalMs}
    />
  );
}
