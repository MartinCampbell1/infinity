"use client";

import { useEffect } from "react";

export function RunLiveRefresh({
  enabled,
  intervalMs = 2500,
}: {
  enabled: boolean;
  intervalMs?: number;
}) {
  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      window.location.reload();
    }, intervalMs);

    return () => window.clearInterval(interval);
  }, [enabled, intervalMs]);

  return (
    <span
      hidden
      data-run-live-refresh={enabled ? "active" : "idle"}
      data-run-live-refresh-interval-ms={intervalMs}
    />
  );
}
