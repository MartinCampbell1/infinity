import type {
  AccountCapacityState,
  AccountPressure,
  AccountQuotaSnapshot,
} from "../contracts/quota";

const PRESSURE_RANK: Record<AccountPressure, number> = {
  low: 0,
  medium: 1,
  high: 2,
  exhausted: 3,
  unknown: 4,
};

function toPressureFromPercent(usedPercent: number | null): AccountPressure {
  if (usedPercent === null) {
    return "unknown";
  }
  if (usedPercent >= 100) {
    return "exhausted";
  }
  if (usedPercent >= 80) {
    return "high";
  }
  if (usedPercent >= 50) {
    return "medium";
  }
  return "low";
}

function maxUsedPercent(snapshot: AccountQuotaSnapshot): number | null {
  const values = snapshot.buckets
    .map((bucket) => bucket.usedPercent)
    .filter((value): value is number => typeof value === "number");
  if (!values.length) {
    return null;
  }
  return Math.max(...values);
}

function parseApiKeyPressure(snapshot: AccountQuotaSnapshot): AccountPressure {
  const value = snapshot.raw?.throttleLevel;
  if (
    value === "low" ||
    value === "medium" ||
    value === "high" ||
    value === "exhausted" ||
    value === "unknown"
  ) {
    return value;
  }
  const concurrentSessions = snapshot.raw?.concurrentSessions;
  if (typeof concurrentSessions === "number") {
    if (concurrentSessions >= 8) {
      return "exhausted";
    }
    if (concurrentSessions >= 4) {
      return "high";
    }
    if (concurrentSessions >= 2) {
      return "medium";
    }
    return "low";
  }
  return "unknown";
}

function nextResetFromBuckets(snapshot: AccountQuotaSnapshot): string | null {
  const values = snapshot.buckets
    .map((bucket) => bucket.resetsAt)
    .filter((value): value is string => typeof value === "string")
    .sort((a, b) => a.localeCompare(b));
  return values[0] ?? null;
}

export function rankCapacityState(
  capacity: Pick<AccountCapacityState, "pressure" | "schedulable">
): number {
  return capacity.schedulable ? PRESSURE_RANK[capacity.pressure] : 100 + PRESSURE_RANK[capacity.pressure];
}

export function deriveAccountCapacityState(
  snapshot: AccountQuotaSnapshot
): AccountCapacityState {
  if (snapshot.authMode === "apikey") {
    const pressure = parseApiKeyPressure(snapshot);
    const blocked = snapshot.raw?.blocked === true || snapshot.raw?.suspended === true;
    const schedulable = !blocked && pressure !== "exhausted";
    const reasonCodes = blocked
      ? ["account_blocked"]
      : pressure === "unknown"
        ? ["insufficient_runtime_signals"]
        : snapshot.raw?.throttleLevel
          ? ["runtime_backpressure"]
          : ["runtime_concurrency_pressure"];
    return {
      accountId: snapshot.accountId,
      schedulable,
      pressure,
      reason:
        "API-key accounts use usage-priced runtime capacity signals, not ChatGPT bucket semantics.",
      reasonCodes,
      nextResetAt:
        typeof snapshot.raw?.nextBillingResetAt === "string"
          ? snapshot.raw.nextBillingResetAt
          : typeof snapshot.raw?.nextResetAt === "string"
            ? snapshot.raw.nextResetAt
          : null,
      preferredForNewSessions: false,
    };
  }

  const pressure = toPressureFromPercent(maxUsedPercent(snapshot));
  const canonical = snapshot.source === "openai_app_server";
  const degradedSource = !canonical && snapshot.source !== "chatgpt_usage_panel";
  const sourceReasonCode = canonical
    ? "canonical_rate_limit_pressure"
    : snapshot.source === "chatgpt_usage_panel"
      ? "fallback_usage_panel_pressure"
      : "fallback_runtime_pressure";

  return {
    accountId: snapshot.accountId,
    schedulable: pressure !== "exhausted",
    pressure,
    reason: canonical
      ? "Derived from canonical app-server rate-limit buckets."
      : "Derived from non-canonical fallback quota signals.",
    reasonCodes: pressure === "unknown"
      ? degradedSource
        ? ["non_canonical_quota_source", "insufficient_bucket_data"]
        : ["insufficient_bucket_data"]
      : degradedSource
        ? ["non_canonical_quota_source", sourceReasonCode]
        : [sourceReasonCode],
    nextResetAt: nextResetFromBuckets(snapshot),
    preferredForNewSessions: false,
  };
}
