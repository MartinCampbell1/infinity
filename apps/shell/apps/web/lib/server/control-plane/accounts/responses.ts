import type {
  AccountQuotaTruthPolicy,
  ControlPlaneAccountQuotaIngestResponse,
  ControlPlaneAccountDetailResponse,
  ControlPlaneAccountDirectoryResponse,
  ControlPlaneAccountQuotaFeedResponse,
  ControlPlaneAccountQuotaSnapshotView,
  ControlPlaneAccountResponseEnvelope,
} from "../contracts/quota";
import {
  buildControlPlaneStateNotes,
  getControlPlaneIntegrationState,
  getControlPlaneStorageKind,
  getControlPlaneStorageSource,
} from "../state/store";
import type { ControlPlaneAccountRecord } from "./types";

const GENERATED_AT = "2026-04-11T13:10:00.000Z";

export const MOCK_QUOTA_TRUTH_POLICY: AccountQuotaTruthPolicy = {
  canonicalSource: "openai_app_server",
  fallbackOrder: ["chatgpt_usage_panel", "observed_runtime", "router_derived"],
  note:
    "ChatGPT-authenticated accounts use app-server rate-limit reads as canonical truth; fallback sources are for degraded display only.",
};

export function buildAccountResponseEnvelope(): ControlPlaneAccountResponseEnvelope {
  const storageKind = getControlPlaneStorageKind();
  return {
    generatedAt: GENERATED_AT,
    source: getControlPlaneStorageSource(),
    storageKind,
    integrationState: getControlPlaneIntegrationState(),
    canonicalTruth: "sessionId",
    notes: buildControlPlaneStateNotes([
      storageKind === "postgres"
        ? "Account snapshots and quota updates are sourced from the shell-owned Postgres control-plane state."
        : "Account snapshots and quota updates are sourced from the unified local shell-backed control-plane state file.",
      "Preferred-account derivation still respects canonical app-server quota truth for ChatGPT-authenticated accounts.",
    ]),
  };
}

export function buildAccountDirectoryResponse(
  accounts: ControlPlaneAccountRecord[],
  preferredAccountId: string | null
): ControlPlaneAccountDirectoryResponse<ControlPlaneAccountRecord> {
  return {
    ...buildAccountResponseEnvelope(),
    quotaTruthPolicy: MOCK_QUOTA_TRUTH_POLICY,
    accounts,
    preferredAccountId,
  };
}

export function buildAccountDetailResponse(
  account: ControlPlaneAccountRecord
): ControlPlaneAccountDetailResponse<ControlPlaneAccountRecord> {
  return {
    ...buildAccountResponseEnvelope(),
    quotaTruthPolicy: MOCK_QUOTA_TRUTH_POLICY,
    account,
  };
}

export function buildQuotaFeedResponse<TCapacity = unknown, TUpdate = unknown>(params: {
  since: number;
  nextSince: number;
  snapshots: ControlPlaneAccountQuotaSnapshotView<TCapacity>[];
  updates: TUpdate[];
  canonicalQuotaSource?: AccountQuotaTruthPolicy["canonicalSource"];
}): ControlPlaneAccountQuotaFeedResponse<TCapacity, TUpdate> {
  return {
    ...buildAccountResponseEnvelope(),
    quotaTruthPolicy: MOCK_QUOTA_TRUTH_POLICY,
    canonicalQuotaSource: params.canonicalQuotaSource ?? MOCK_QUOTA_TRUTH_POLICY.canonicalSource,
    since: params.since,
    nextSince: params.nextSince,
    snapshots: params.snapshots,
    updates: params.updates,
  };
}

export function buildQuotaIngestResponse<TCapacity = unknown, TUpdate = unknown>(params: {
  snapshot: ControlPlaneAccountQuotaSnapshotView<TCapacity>["snapshot"];
  update: TUpdate;
  capacity: TCapacity | null;
  affectedSessionIds: string[];
  persistedEvents: ControlPlaneAccountQuotaIngestResponse<TCapacity, TUpdate>["persistedEvents"];
  canonicalQuotaSource?: AccountQuotaTruthPolicy["canonicalSource"];
}): ControlPlaneAccountQuotaIngestResponse<TCapacity, TUpdate> {
  return {
    ...buildAccountResponseEnvelope(),
    quotaTruthPolicy: MOCK_QUOTA_TRUTH_POLICY,
    canonicalQuotaSource: params.canonicalQuotaSource ?? MOCK_QUOTA_TRUTH_POLICY.canonicalSource,
    accepted: true,
    snapshot: params.snapshot,
    update: params.update,
    capacity: params.capacity,
    affectedSessionIds: params.affectedSessionIds,
    persistedEvents: params.persistedEvents,
  };
}

export const buildMockResponseEnvelope = buildAccountResponseEnvelope;
export const buildMockAccountDirectoryResponse = buildAccountDirectoryResponse;
export const buildMockAccountDetailResponse = buildAccountDetailResponse;
export const buildMockQuotaFeedResponse = buildQuotaFeedResponse;
export const buildMockQuotaIngestResponse = buildQuotaIngestResponse;
