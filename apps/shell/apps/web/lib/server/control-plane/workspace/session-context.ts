import type { ShellRouteScope } from "../../../route-scope";
import {
  buildExecutionSessionScopeHref,
  buildExecutionSessionsScopeHref,
  routeScopeFromExecutionBindingRef,
} from "../../../route-scope";

import { deriveAccountCapacityState } from "../accounts/capacity";
import { materializeSessionProjections } from "../events";
import type { ExecutionSessionPhase } from "../contracts/session-events";
import type {
  WorkspaceHostQuotaState,
  WorkspaceLaunchSessionContext,
} from "../contracts/workspace-launch";
import { CONTROL_PLANE_ACCOUNT_META } from "../state/seeds";
import { readControlPlaneState } from "../state/store";
import { buildWorkspaceLaunchViewModel } from "./launch";

type ControlPlaneState = Awaited<ReturnType<typeof readControlPlaneState>>;

type SessionLaunchSeed = {
  sessionId: string;
  openedFrom?: WorkspaceLaunchSessionContext["openedFrom"];
  status: WorkspaceLaunchSessionContext["status"];
  phase?: WorkspaceLaunchSessionContext["phase"];
};

function normalizePhase(
  value: string | null | undefined,
): ExecutionSessionPhase | null {
  return value === "planning" ||
    value === "acting" ||
    value === "validating" ||
    value === "blocked" ||
    value === "review" ||
    value === "completed" ||
    value === "unknown"
    ? value
    : null;
}

function inferOpenedFromFallback(
  session: SessionLaunchSeed,
  routeScope?: Partial<ShellRouteScope> | null,
) {
  if (session.openedFrom && session.openedFrom !== "unknown") {
    return session.openedFrom;
  }
  if (routeScope?.groupId) {
    return "group_board" as const;
  }
  if (session.status === "waiting_for_approval" || session.phase === "review") {
    return "review" as const;
  }
  if (session.sessionId) {
    return "execution_board" as const;
  }
  return "unknown" as const;
}

function humanizeAccountLabel(accountId: string | null | undefined) {
  if (!accountId) {
    return null;
  }

  return accountId.replace(/^account-/, "").replace(/-/g, " ");
}

function findLatestAccountSnapshot(
  accountId: string,
  state: ControlPlaneState,
) {
  const latestUpdate = [...state.accounts.updates]
    .filter((update) => update.accountId === accountId)
    .sort((left, right) => right.sequence - left.sequence)[0];

  if (latestUpdate?.snapshot) {
    return latestUpdate.snapshot;
  }

  const snapshots = state.accounts.snapshots.filter(
    (snapshot) => snapshot.accountId === accountId,
  );
  return snapshots[snapshots.length - 1] ?? null;
}

function buildQuotaState(
  accountId: string | null | undefined,
  state: ControlPlaneState,
): WorkspaceHostQuotaState {
  if (!accountId) {
    return {
      pressure: "unknown",
      usedPercent: null,
      resetsAt: null,
    };
  }

  const snapshot = findLatestAccountSnapshot(accountId, state);
  if (!snapshot) {
    return {
      pressure: "unknown",
      usedPercent: null,
      resetsAt: null,
    };
  }

  const capacity = deriveAccountCapacityState(snapshot);
  const usedPercentValues = snapshot.buckets
    .map((bucket) => bucket.usedPercent)
    .filter((value): value is number => typeof value === "number");
  const resetValues = snapshot.buckets
    .map((bucket) => bucket.resetsAt)
    .filter((value): value is string => typeof value === "string")
    .sort((left, right) => left.localeCompare(right));

  return {
    pressure: capacity.pressure,
    usedPercent: usedPercentValues.length ? Math.max(...usedPercentValues) : null,
    resetsAt: resetValues[0] ?? null,
  };
}

function countPendingApprovals(
  sessionId: string,
  state: ControlPlaneState,
) {
  return state.approvals.requests.filter(
    (request) => request.sessionId === sessionId && request.status === "pending",
  ).length;
}

function deriveExecutionMode(provider: WorkspaceLaunchSessionContext["provider"]) {
  if (provider === "hermes") {
    return "hermes" as const;
  }
  if (provider === "codex") {
    return "worktree" as const;
  }
  if (provider === "openwebui") {
    return "cloud" as const;
  }
  return "unknown" as const;
}

export async function buildWorkspaceLaunchSessionContext(
  sessionId: string,
  routeScope?: Partial<ShellRouteScope> | null,
  openedFrom?: WorkspaceLaunchSessionContext["openedFrom"],
): Promise<WorkspaceLaunchSessionContext> {
  const state = await readControlPlaneState();
  const session = materializeSessionProjections(state.sessions.events)[sessionId];
  if (!session) {
    const resolvedScope = routeScopeFromExecutionBindingRef({ sessionId }, routeScope);

    return {
      projectId: resolvedScope.projectId || "project-unknown",
      projectName: resolvedScope.projectId || "Unknown project",
      sessionId,
      sessionTitle: "Work mode handoff",
      externalSessionId: null,
      groupId: resolvedScope.groupId || null,
      accountId: resolvedScope.accountId || null,
      accountLabel: null,
      workspaceId: resolvedScope.workspaceId || null,
      provider: "unknown",
      model: null,
      executionMode: "unknown",
      quotaState: {
        pressure: "unknown",
        usedPercent: null,
        resetsAt: null,
      },
      pendingApprovals: 0,
      openedFrom: openedFrom || "unknown",
      status: "unknown",
      phase: "unknown",
    };
  }

  const accountMeta =
    session.accountId ? CONTROL_PLANE_ACCOUNT_META[session.accountId] ?? null : null;

  const inferredOpenedFrom =
    openedFrom ||
    inferOpenedFromFallback(
      {
        sessionId: session.id,
        status: session.status,
        phase: normalizePhase(session.phase),
      },
      routeScope,
    );

  const pendingApprovals = Math.max(
    session.pendingApprovals,
    countPendingApprovals(session.id, state),
  );

  return {
    projectId: session.projectId,
    projectName: session.projectName,
    sessionId: session.id,
    sessionTitle: session.title,
    externalSessionId: session.externalSessionId ?? null,
    groupId: session.groupId ?? null,
    accountId: session.accountId ?? null,
    accountLabel:
      accountMeta?.label ?? humanizeAccountLabel(session.accountId) ?? null,
    workspaceId: session.workspaceId ?? null,
    provider: session.provider,
    model: session.model ?? null,
    executionMode: deriveExecutionMode(session.provider),
    quotaState: buildQuotaState(session.accountId, state),
    pendingApprovals,
    openedFrom: inferredOpenedFrom,
    status: session.status,
    phase: normalizePhase(session.phase) ?? "unknown",
  };
}

export async function buildWorkspaceLaunchViewModelForSession(
  sessionId: string,
  routeScope?: Partial<ShellRouteScope> | null,
  options?: {
    openedFrom?:
      | "dashboard"
      | "execution_board"
      | "review"
      | "group_board"
      | "deep_link"
      | "unknown";
  },
) {
  const session = await buildWorkspaceLaunchSessionContext(
    sessionId,
    routeScope,
    options?.openedFrom,
  );
  const shellScope = routeScopeFromExecutionBindingRef(
    {
      sessionId: session.sessionId,
      groupId: session.groupId,
      accountId: session.accountId,
      workspaceId: session.workspaceId,
    },
    routeScope,
  );

  return buildWorkspaceLaunchViewModel(session, {
    shellSessionsHref: buildExecutionSessionsScopeHref(shellScope),
    shellSessionHref: buildExecutionSessionScopeHref(session.sessionId, shellScope),
  });
}

export const readWorkspaceLaunchSessionContext =
  buildWorkspaceLaunchSessionContext;

export const buildWorkspaceLaunchViewModelFromState =
  buildWorkspaceLaunchViewModelForSession;
