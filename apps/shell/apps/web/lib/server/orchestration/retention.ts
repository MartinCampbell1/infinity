import { rmSync } from "node:fs";
import path from "node:path";

import type {
  AutonomousAgentSessionRecord,
  ControlPlaneState,
} from "../control-plane/state/types";
import { readControlPlaneState, updateControlPlaneState } from "../control-plane/state/store";

import {
  artifactLocalPath,
  resolveOrchestrationArtifactsRoot,
  resolveOrchestrationDeliveriesRoot,
} from "./artifacts";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export const DEFAULT_ORCHESTRATION_RETENTION_POLICY = {
  failedPreviewTtlMs: 7 * DAY_MS,
  failedHandoffTtlMs: 7 * DAY_MS,
  rejectedDeliveryArtifactTtlMs: 30 * DAY_MS,
  staleAgentSessionTtlMs: 2 * HOUR_MS,
} as const;

export type OrchestrationRetentionPolicy = Partial<
  typeof DEFAULT_ORCHESTRATION_RETENTION_POLICY
> & {
  allowedLocalRoots?: readonly string[];
};

export interface OrchestrationRetentionPlan {
  generatedAt: string;
  dryRun: boolean;
  policy: typeof DEFAULT_ORCHESTRATION_RETENTION_POLICY;
  expiredPreviewTargetIds: string[];
  expiredHandoffPacketIds: string[];
  staleAgentSessionIds: string[];
  localArtifactPaths: string[];
  notes: string[];
}

export interface OrchestrationRetentionResult {
  plan: OrchestrationRetentionPlan;
  removedLocalArtifactPaths: string[];
  filesystemErrors: Array<{ path: string; detail: string }>;
}

function mergedPolicy(policy: OrchestrationRetentionPolicy = {}) {
  return {
    ...DEFAULT_ORCHESTRATION_RETENTION_POLICY,
    ...Object.fromEntries(
      Object.entries(policy).filter(([key]) => key !== "allowedLocalRoots"),
    ),
  };
}

function parseTimestamp(value?: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isOlderThan(value: string | null | undefined, nowMs: number, ttlMs: number) {
  const parsed = parseTimestamp(value);
  return parsed !== null && nowMs - parsed >= ttlMs;
}

function uniqueSorted(values: Iterable<string>) {
  return [...new Set([...values].filter(Boolean))].sort((left, right) =>
    left.localeCompare(right),
  );
}

function normalizeRoot(value: string) {
  return path.resolve(value.trim());
}

function defaultAllowedLocalRoots() {
  return [resolveOrchestrationArtifactsRoot(), resolveOrchestrationDeliveriesRoot()]
    .map(normalizeRoot)
    .filter(Boolean);
}

function isUnderRoot(candidatePath: string, rootPath: string) {
  const relative = path.relative(rootPath, candidatePath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function localPathIfRetainable(
  value: string | null | undefined,
  allowedLocalRoots: readonly string[],
) {
  const candidate = value ? artifactLocalPath(value) ?? value : null;
  if (!candidate || !path.isAbsolute(candidate)) {
    return null;
  }

  const normalized = path.resolve(candidate);
  return allowedLocalRoots.some((root) => isUnderRoot(normalized, root)) ? normalized : null;
}

function activeSessionIsStale(
  session: AutonomousAgentSessionRecord,
  nowMs: number,
  staleAgentSessionTtlMs: number,
) {
  if (session.finishedAt || (session.status !== "starting" && session.status !== "running")) {
    return false;
  }

  return isOlderThan(session.startedAt ?? null, nowMs, staleAgentSessionTtlMs);
}

export function buildOrchestrationRetentionPlan(
  state: ControlPlaneState,
  options: {
    now?: string | Date;
    dryRun?: boolean;
    policy?: OrchestrationRetentionPolicy;
  } = {},
): OrchestrationRetentionPlan {
  const now = options.now instanceof Date ? options.now : new Date(options.now ?? Date.now());
  const generatedAt = Number.isNaN(now.getTime())
    ? new Date(0).toISOString()
    : now.toISOString();
  const nowMs = Date.parse(generatedAt);
  const policy = mergedPolicy(options.policy);
  const allowedLocalRoots = (options.policy?.allowedLocalRoots ?? defaultAllowedLocalRoots()).map(
    normalizeRoot,
  );
  const deliveriesById = new Map(
    state.orchestration.deliveries.map((delivery) => [delivery.id, delivery]),
  );
  const runsById = new Map(state.orchestration.runs.map((run) => [run.id, run]));

  const expiredPreviewTargetIds = state.orchestration.previewTargets
    .filter((preview) => {
      if (!isOlderThan(preview.updatedAt, nowMs, policy.failedPreviewTtlMs)) {
        return false;
      }

      const delivery = deliveriesById.get(preview.deliveryId) ?? null;
      if (delivery?.status === "ready" || delivery?.status === "delivered") {
        return false;
      }

      const run = runsById.get(preview.runId) ?? null;
      return (
        preview.healthStatus === "failed" ||
        delivery?.status === "rejected" ||
        run?.currentStage === "failed" ||
        run?.currentStage === "cancelled"
      );
    })
    .map((preview) => preview.id);

  const expiredHandoffPacketIds = state.orchestration.handoffPackets
    .filter(
      (handoff) =>
        handoff.status !== "ready" &&
        isOlderThan(handoff.updatedAt, nowMs, policy.failedHandoffTtlMs),
    )
    .map((handoff) => handoff.id);

  const staleAgentSessionIds = state.orchestration.agentSessions
    .filter((session) =>
      activeSessionIsStale(session, nowMs, policy.staleAgentSessionTtlMs),
    )
    .map((session) => session.id);

  const previewArtifactPaths = state.orchestration.previewTargets
    .filter((preview) => expiredPreviewTargetIds.includes(preview.id))
    .map((preview) => localPathIfRetainable(preview.sourcePath, allowedLocalRoots))
    .filter((value): value is string => Boolean(value));

  const handoffArtifactPaths = state.orchestration.handoffPackets
    .filter((handoff) => expiredHandoffPacketIds.includes(handoff.id))
    .flatMap((handoff) => [handoff.rootPath, handoff.finalSummaryPath, handoff.manifestPath])
    .map((candidate) => localPathIfRetainable(candidate, allowedLocalRoots))
    .filter((value): value is string => Boolean(value));

  const rejectedDeliveryArtifactPaths = state.orchestration.deliveries
    .filter(
      (delivery) =>
        delivery.status === "rejected" &&
        isOlderThan(
          delivery.deliveredAt ?? delivery.launchProofAt ?? null,
          nowMs,
          policy.rejectedDeliveryArtifactTtlMs,
        ),
    )
    .flatMap((delivery) => [
      delivery.localOutputPath,
      delivery.manifestPath,
      delivery.launchManifestPath,
    ])
    .map((candidate) => localPathIfRetainable(candidate, allowedLocalRoots))
    .filter((value): value is string => Boolean(value));

  return {
    generatedAt,
    dryRun: options.dryRun ?? false,
    policy,
    expiredPreviewTargetIds: uniqueSorted(expiredPreviewTargetIds),
    expiredHandoffPacketIds: uniqueSorted(expiredHandoffPacketIds),
    staleAgentSessionIds: uniqueSorted(staleAgentSessionIds),
    localArtifactPaths: uniqueSorted([
      ...previewArtifactPaths,
      ...handoffArtifactPaths,
      ...rejectedDeliveryArtifactPaths,
    ]),
    notes: [
      "Ready and delivered delivery artifacts are preserved by shell retention.",
      "Production object-store lifecycle policies remain the source of truth for durable artifact expiry.",
      "Execution-kernel attempt leases are recovered by the kernel; this job only cleans shell-side stale agent-session mirrors.",
    ],
  };
}

export function applyOrchestrationRetentionPlan(
  draft: ControlPlaneState,
  plan: OrchestrationRetentionPlan,
) {
  const staleAgentSessionIds = new Set(plan.staleAgentSessionIds);
  const expiredPreviewTargetIds = new Set(plan.expiredPreviewTargetIds);
  const expiredHandoffPacketIds = new Set(plan.expiredHandoffPacketIds);
  const runsById = new Map(draft.orchestration.runs.map((run) => [run.id, run]));

  draft.orchestration.previewTargets = draft.orchestration.previewTargets.filter(
    (preview) => !expiredPreviewTargetIds.has(preview.id),
  );
  draft.orchestration.handoffPackets = draft.orchestration.handoffPackets.filter(
    (handoff) => !expiredHandoffPacketIds.has(handoff.id),
  );
  draft.orchestration.agentSessions = draft.orchestration.agentSessions.map((session) => {
    if (!staleAgentSessionIds.has(session.id)) {
      return session;
    }

    const run = runsById.get(session.runId);
    if (run) {
      draft.orchestration.runEvents = [
        {
          id: `retention-${session.id}-${plan.generatedAt.replace(/[^0-9]/g, "")}`,
          runId: session.runId,
          initiativeId: run.initiativeId,
          kind: "agent.session.retention_recovered",
          stage: "blocked",
          summary: `Stale agent session ${session.id} exceeded the retention lease mirror window and was marked failed.`,
          payload: {
            agentSessionId: session.id,
            batchId: session.batchId,
            workItemId: session.workItemId,
            attemptId: session.attemptId ?? null,
            generatedAt: plan.generatedAt,
          },
          createdAt: plan.generatedAt,
        },
        ...draft.orchestration.runEvents,
      ];
    }

    return {
      ...session,
      status: "failed",
      finishedAt: plan.generatedAt,
    };
  });

  return {
    expiredPreviewTargets: expiredPreviewTargetIds.size,
    expiredHandoffPackets: expiredHandoffPacketIds.size,
    staleAgentSessions: staleAgentSessionIds.size,
  };
}

export async function runOrchestrationRetentionCleanup(
  options: {
    now?: string | Date;
    dryRun?: boolean;
    applyFilesystem?: boolean;
    policy?: OrchestrationRetentionPolicy;
  } = {},
): Promise<OrchestrationRetentionResult> {
  if (options.dryRun) {
    const state = await readControlPlaneState();
    return {
      plan: buildOrchestrationRetentionPlan(state, {
        now: options.now,
        dryRun: true,
        policy: options.policy,
      }),
      removedLocalArtifactPaths: [],
      filesystemErrors: [],
    };
  }

  const cleanup: { plan?: OrchestrationRetentionPlan } = {};
  await updateControlPlaneState((draft) => {
    const plan = buildOrchestrationRetentionPlan(draft, {
      now: options.now,
      dryRun: false,
      policy: options.policy,
    });
    cleanup.plan = plan;
    applyOrchestrationRetentionPlan(draft, plan);
  });

  const plan = cleanup.plan;
  if (!plan) {
    throw new Error("Failed to build orchestration retention plan.");
  }

  const removedLocalArtifactPaths: string[] = [];
  const filesystemErrors: Array<{ path: string; detail: string }> = [];
  if (options.applyFilesystem) {
    for (const artifactPath of plan.localArtifactPaths) {
      try {
        rmSync(artifactPath, { recursive: true, force: true });
        removedLocalArtifactPaths.push(artifactPath);
      } catch (error) {
        filesystemErrors.push({
          path: artifactPath,
          detail: error instanceof Error ? error.message : "Unknown filesystem cleanup error.",
        });
      }
    }
  }

  return {
    plan,
    removedLocalArtifactPaths,
    filesystemErrors,
  };
}
