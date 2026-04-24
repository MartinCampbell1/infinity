import type { NormalizedExecutionEvent } from "./session-events";
import type { TenantScopedRecordFields } from "./tenancy";

export type AccountAuthMode = "chatgpt" | "chatgptAuthTokens" | "apikey" | "unknown";

export type AccountQuotaSource =
  | "openai_app_server"
  | "chatgpt_usage_panel"
  | "observed_runtime"
  | "router_derived";

export type AccountQuotaFallbackSource = Exclude<AccountQuotaSource, "openai_app_server">;

export type AccountPressure = "low" | "medium" | "high" | "exhausted" | "unknown";

export interface AccountQuotaBucket {
  limitId: string;
  limitName?: string | null;
  usedPercent?: number | null;
  windowDurationMins?: number | null;
  resetsAt?: string | null;
}

export interface AccountQuotaSnapshot extends TenantScopedRecordFields {
  accountId: string;
  authMode: AccountAuthMode;
  source: AccountQuotaSource;
  observedAt: string;
  buckets: AccountQuotaBucket[];
  raw?: Record<string, unknown> | null;
}

export interface AccountQuotaUpdateActorContext {
  actorType: "operator" | "system";
  actorId: string;
  tenantId: string;
  requestId: string;
  authBoundary: string;
}

export interface AccountQuotaUpdate extends TenantScopedRecordFields {
  sequence: number;
  accountId: string;
  source: AccountQuotaSource;
  observedAt: string;
  summary: string;
  snapshot: AccountQuotaSnapshot;
  actorContext?: AccountQuotaUpdateActorContext | null;
}

export interface AccountCapacityState {
  accountId: string;
  schedulable: boolean;
  pressure: AccountPressure;
  reason?: string | null;
  reasonCodes?: string[];
  nextResetAt?: string | null;
  preferredForNewSessions: boolean;
}

export interface AccountQuotaTruthPolicy {
  canonicalSource: "openai_app_server";
  fallbackOrder: AccountQuotaFallbackSource[];
  note: string;
}

export interface ControlPlaneAccountResponseEnvelope {
  generatedAt: string;
  source: "mock" | "postgres" | "upstream" | "derived";
  storageKind: "in_memory" | "file_backed" | "postgres" | "unknown";
  integrationState: "unknown" | "mocked" | "wired" | "degraded";
  canonicalTruth: "sessionId";
  notes: string[];
}

export interface ControlPlaneAccountDirectoryResponse<TAccount = unknown>
  extends ControlPlaneAccountResponseEnvelope {
  quotaTruthPolicy: AccountQuotaTruthPolicy;
  accounts: TAccount[];
  preferredAccountId: string | null;
}

export interface ControlPlaneAccountDetailResponse<TAccount = unknown>
  extends ControlPlaneAccountResponseEnvelope {
  quotaTruthPolicy: AccountQuotaTruthPolicy;
  account: TAccount;
}

export interface ControlPlaneAccountQuotaSnapshotView<TCapacity = unknown> {
  snapshot: AccountQuotaSnapshot;
  capacity: TCapacity | null;
}

export interface ControlPlaneAccountQuotaFeedResponse<TCapacity = unknown, TUpdate = AccountQuotaUpdate>
  extends ControlPlaneAccountResponseEnvelope {
  quotaTruthPolicy: AccountQuotaTruthPolicy;
  canonicalQuotaSource: AccountQuotaSource;
  since: number;
  nextSince: number;
  snapshots: ControlPlaneAccountQuotaSnapshotView<TCapacity>[];
  updates: TUpdate[];
}

export interface AccountQuotaProducerIngestRequest {
  producer: AccountQuotaSource;
  snapshot: AccountQuotaSnapshot;
  summary?: string;
  sessionIds?: string[];
}

export interface ControlPlaneAccountQuotaIngestResponse<
  TCapacity = unknown,
  TUpdate = AccountQuotaUpdate
> extends ControlPlaneAccountResponseEnvelope {
  quotaTruthPolicy: AccountQuotaTruthPolicy;
  canonicalQuotaSource: AccountQuotaSource;
  accepted: boolean;
  snapshot: AccountQuotaSnapshot;
  update: TUpdate;
  capacity: TCapacity | null;
  affectedSessionIds: string[];
  persistedEvents: NormalizedExecutionEvent[];
}
