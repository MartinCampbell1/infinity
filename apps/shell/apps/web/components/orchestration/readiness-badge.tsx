import React from "react";

import type { DeliveryReadinessCopy, DeliveryProofChecklistItem } from "@/lib/delivery-readiness";

const BADGE_STYLES = {
  missing: "border-amber-400/24 bg-amber-400/[0.08] text-amber-100",
  local_solo: "border-sky-400/24 bg-sky-400/[0.08] text-sky-100",
  staging: "border-violet-300/24 bg-violet-300/[0.08] text-violet-100",
  production: "border-emerald-400/24 bg-emerald-400/[0.08] text-emerald-100",
} as const;

export function ReadinessBadge({
  readiness,
  className = "",
}: {
  readiness: DeliveryReadinessCopy;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] ${BADGE_STYLES[readiness.badgeTier]} ${className}`}
      data-readiness-badge-tier={readiness.badgeTier}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {readiness.badgeLabel}
    </span>
  );
}

export function ReadinessChecklist({
  items,
  title = "Proof checklist",
}: {
  items: DeliveryProofChecklistItem[];
  title?: string;
}) {
  return (
    <div
      className="rounded-[12px] border border-white/8 bg-white/[0.025] px-4 py-4"
      data-readiness-checklist="delivery-proof"
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--shell-sidebar-muted)]">
        {title}
      </div>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <div
            key={item.key}
            className="grid grid-cols-[24px_132px_minmax(0,1fr)] items-center gap-3 rounded-[9px] border border-white/6 bg-white/[0.02] px-3 py-2"
            data-readiness-check={item.key}
            data-readiness-check-satisfied={item.satisfied ? "true" : "false"}
          >
            <span
              className={`font-mono text-[11px] ${
                item.satisfied ? "text-emerald-200" : "text-amber-200"
              }`}
              aria-hidden="true"
            >
              {item.satisfied ? "OK" : "!"}
            </span>
            <span className="text-[11px] text-white/82">{item.label}</span>
            <span className="truncate font-mono text-[10.5px] text-[var(--shell-sidebar-muted)]">
              {item.detail}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
