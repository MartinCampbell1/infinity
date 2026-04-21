import type { AccountQuotaSnapshot, AccountQuotaUpdate } from "../contracts/quota";
import { CONTROL_PLANE_ACCOUNT_META } from "../state/seeds";
import {
  readAccountQuotaSnapshotsFromPostgres,
  readAccountQuotaUpdatesFromPostgres,
} from "../state/postgres";
import { getWiredControlPlaneDatabaseUrl, readControlPlaneState } from "../state/store";
import type { ControlPlaneAccountRecord } from "./types";
import { deriveAccountCapacityState, rankCapacityState } from "./capacity";

function compareAccountsForPreference(
  a: ControlPlaneAccountRecord,
  b: ControlPlaneAccountRecord
): number {
  const aAuthPriority =
    a.authMode === "chatgpt" || a.authMode === "chatgptAuthTokens" ? 0 : 1;
  const bAuthPriority =
    b.authMode === "chatgpt" || b.authMode === "chatgptAuthTokens" ? 0 : 1;
  if (aAuthPriority !== bAuthPriority) {
    return aAuthPriority - bAuthPriority;
  }

  const sourcePriority = (account: ControlPlaneAccountRecord) => {
    if (account.quota.source === "openai_app_server") {
      return 0;
    }
    if (account.quota.source === "chatgpt_usage_panel") {
      return 1;
    }
    if (account.quota.source === "observed_runtime") {
      return 2;
    }
    return 3;
  };

  const aSourcePriority = sourcePriority(a);
  const bSourcePriority = sourcePriority(b);
  if (aSourcePriority !== bSourcePriority) {
    return aSourcePriority - bSourcePriority;
  }

  const aCapacityPriority = rankCapacityState(a.capacity);
  const bCapacityPriority = rankCapacityState(b.capacity);
  if (aCapacityPriority !== bCapacityPriority) {
    return aCapacityPriority - bCapacityPriority;
  }

  return a.id.localeCompare(b.id);
}

function buildAccountsFromSnapshots(
  snapshots: AccountQuotaSnapshot[]
): ControlPlaneAccountRecord[] {
  const latestByAccount = new Map<string, AccountQuotaSnapshot>();
  for (const snapshot of snapshots) {
    const existing = latestByAccount.get(snapshot.accountId);
    if (!existing || snapshot.observedAt.localeCompare(existing.observedAt) > 0) {
      latestByAccount.set(snapshot.accountId, snapshot);
    }
  }

  const accounts = Array.from(latestByAccount.values()).map((quota) => {
    const meta = CONTROL_PLANE_ACCOUNT_META[quota.accountId] ?? {
      label: quota.accountId.replace(/^account-/, "").replace(/-/g, " "),
      provider: "unknown" as const,
    };
    return {
      id: quota.accountId,
      label: meta.label,
      authMode: quota.authMode,
      provider: meta.provider,
      quota,
      capacity: deriveAccountCapacityState(quota),
    } satisfies ControlPlaneAccountRecord;
  });
  const preferred = accounts
    .filter((account) => account.capacity.schedulable)
    .sort(compareAccountsForPreference)[0];
  return accounts.map((account) => ({
    ...account,
    capacity: {
      ...account.capacity,
      preferredForNewSessions: account.id === preferred?.id,
    },
  }));
}

export async function listControlPlaneQuotaSnapshots() {
  const databaseUrl = await getWiredControlPlaneDatabaseUrl();
  if (databaseUrl) {
    return readAccountQuotaSnapshotsFromPostgres(databaseUrl);
  }
  const state = await readControlPlaneState();
  return JSON.parse(JSON.stringify(state.accounts.snapshots)) as AccountQuotaSnapshot[];
}

export async function listControlPlaneQuotaUpdates(sinceSequence = 0) {
  const databaseUrl = await getWiredControlPlaneDatabaseUrl();
  if (databaseUrl) {
    return (await readAccountQuotaUpdatesFromPostgres(databaseUrl)).filter(
      (update) => update.sequence > sinceSequence
    );
  }
  const state = await readControlPlaneState();
  return JSON.parse(
    JSON.stringify(
      state.accounts.updates.filter((update) => update.sequence > sinceSequence)
    )
  ) as AccountQuotaUpdate[];
}

export async function listControlPlaneAccounts() {
  return buildAccountsFromSnapshots(await listControlPlaneQuotaSnapshots());
}

export async function findControlPlaneAccount(accountId: string) {
  return (await listControlPlaneAccounts()).find((account) => account.id === accountId) ?? null;
}

export const listMockQuotaSnapshots = listControlPlaneQuotaSnapshots;
export const listMockQuotaUpdates = listControlPlaneQuotaUpdates;
export const listMockAccounts = listControlPlaneAccounts;
export const findMockAccount = findControlPlaneAccount;
