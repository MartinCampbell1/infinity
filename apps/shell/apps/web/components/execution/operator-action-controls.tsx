"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { ApprovalDecision } from "@/lib/server/control-plane/contracts/approvals";
import type { RecoveryActionKind } from "@/lib/server/control-plane/contracts/recoveries";

function actionTone(tone: "primary" | "neutral" | "danger") {
  if (tone === "primary") {
    return "border border-sky-500/20 bg-sky-500/15 text-sky-100";
  }

  if (tone === "danger") {
    return "border border-rose-500/20 bg-rose-500/12 text-rose-100";
  }

  return "border border-white/12 bg-white/[0.03] text-white/78";
}

export function ApprovalActionStrip({
  approvalId,
  disabled,
}: {
  approvalId: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [busyAction, setBusyAction] = useState<ApprovalDecision | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(decision: ApprovalDecision) {
    if (disabled || busyAction) {
      return;
    }

    setBusyAction(decision);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(
        `/api/control/execution/approvals/${encodeURIComponent(approvalId)}/respond`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ decision }),
        }
      );

      const payload = (await response.json().catch(() => null)) as
        | { detail?: string; rejectedReason?: string | null }
        | null;

      if (!response.ok) {
        throw new Error(
          payload?.detail ||
            payload?.rejectedReason ||
            `Approval action failed: ${response.status}`
        );
      }

      setMessage(`Applied ${decision} to ${approvalId}.`);
      router.refresh();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Approval action failed."
      );
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap gap-2 text-sm">
        {([
          ["approve_once", "Approve once", "primary"],
          ["approve_session", "Approve session", "neutral"],
          ["approve_always", "Approve always", "neutral"],
          ["deny", "Deny", "danger"],
        ] as const).map(([decision, label, tone]) => (
          <button
            key={decision}
            type="button"
            className={`rounded-full px-4 py-2 text-sm transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50 ${actionTone(
              tone
            )}`}
            onClick={() => void run(decision)}
            disabled={disabled || busyAction !== null}
          >
            {busyAction === decision ? "Working…" : label}
          </button>
        ))}
      </div>

      {message ? <div className="text-xs text-emerald-200/88">{message}</div> : null}
      {error ? <div className="text-xs text-rose-200/88">{error}</div> : null}
    </div>
  );
}

export function RecoveryActionStrip({
  recoveryId,
  fallbackAccountId,
  disabled,
  canRetry,
  canFailover,
  canResolve,
  canReopen,
}: {
  recoveryId: string;
  fallbackAccountId?: string | null;
  disabled?: boolean;
  canRetry: boolean;
  canFailover: boolean;
  canResolve: boolean;
  canReopen: boolean;
}) {
  const router = useRouter();
  const [busyAction, setBusyAction] = useState<RecoveryActionKind | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(actionKind: RecoveryActionKind) {
    if (disabled || busyAction) {
      return;
    }

    setBusyAction(actionKind);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(
        `/api/control/execution/recoveries/${encodeURIComponent(recoveryId)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            actionKind,
            ...(actionKind === "failover" && fallbackAccountId
              ? { targetAccountId: fallbackAccountId }
              : {}),
          }),
        }
      );

      const payload = (await response.json().catch(() => null)) as
        | { detail?: string; rejectedReason?: string | null }
        | null;

      if (!response.ok) {
        throw new Error(
          payload?.detail ||
            payload?.rejectedReason ||
            `Recovery action failed: ${response.status}`
        );
      }

      setMessage(`Applied ${actionKind} to ${recoveryId}.`);
      router.refresh();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Recovery action failed."
      );
    } finally {
      setBusyAction(null);
    }
  }

  const actions = [
    canRetry ? { key: "retry" as const, label: "Retry", tone: "primary" as const } : null,
    canFailover
      ? {
          key: "failover" as const,
          label: fallbackAccountId ? `Fail over to ${fallbackAccountId}` : "Fail over",
          tone: "neutral" as const,
        }
      : null,
    canResolve ? { key: "resolve" as const, label: "Resolve", tone: "neutral" as const } : null,
    canReopen ? { key: "reopen" as const, label: "Reopen", tone: "danger" as const } : null,
  ].filter(Boolean) as Array<{
    key: RecoveryActionKind;
    label: string;
    tone: "primary" | "neutral" | "danger";
  }>;

  if (actions.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap gap-2 text-sm">
        {actions.map((action) => (
          <button
            key={action.key}
            type="button"
            className={`rounded-full px-4 py-2 text-sm transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50 ${actionTone(
              action.tone
            )}`}
            onClick={() => void run(action.key)}
            disabled={
              disabled ||
              busyAction !== null ||
              (action.key === "failover" && !fallbackAccountId)
            }
          >
            {busyAction === action.key ? "Working…" : action.label}
          </button>
        ))}
      </div>

      {message ? <div className="text-xs text-emerald-200/88">{message}</div> : null}
      {error ? <div className="text-xs text-rose-200/88">{error}</div> : null}
    </div>
  );
}
