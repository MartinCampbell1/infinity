import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import type {
  AssemblyRecord,
  DeliveryRecord,
  ExecutionBatchRecord,
  InitiativeRecord,
  ProjectBriefRecord,
  TaskGraphRecord,
  VerificationRunRecord,
  WorkUnitRecord,
} from "../control-plane/contracts/orchestration";
import type {
  AutonomousAgentSessionRecord,
  AutonomousHandoffPacketRecord,
  AutonomousPreviewTargetRecord,
  AutonomousRunEventRecord,
  AutonomousRunHealth,
  AutonomousRunRecord,
  AutonomousRunStage,
  AutonomousSpecDocRecord,
  AutonomousValidationProofRecord,
  ControlPlaneState,
} from "../control-plane/state/types";
import { resolveShellPublicOriginForLaunch } from "../control-plane/workspace/rollout-config";

import { resolveInfinityRoot } from "./artifacts";
import { buildOrchestrationId, nowIso } from "./shared";

const AUTONOMOUS_PROOF_BRIEF_AUTHOR = "hermes-intake";

function ensureDir(dirPath: string) {
  mkdirSync(dirPath, { recursive: true });
}

function writeJson(filePath: string, payload: unknown) {
  ensureDir(path.dirname(filePath));
  writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");
}

function writeText(filePath: string, content: string) {
  ensureDir(path.dirname(filePath));
  writeFileSync(filePath, content, "utf8");
}

function sortByNewest<T extends { createdAt: string }>(values: readonly T[]) {
  return [...values].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function resolveAutonomousRunsRoot() {
  return path.join(resolveInfinityRoot(), ".local-state", "orchestration", "runs");
}

export function resolveAutonomousRunRoot(runId: string) {
  return path.join(resolveAutonomousRunsRoot(), runId);
}

function relativeToRunRoot(runId: string, filePath: string) {
  return path.relative(resolveAutonomousRunRoot(runId), filePath);
}

export function findAutonomousRunByInitiativeId(
  state: ControlPlaneState,
  initiativeId: string
) {
  return (
    state.orchestration.runs.find((candidate) => candidate.initiativeId === initiativeId) ?? null
  );
}

export function listAutonomousRuns(state: ControlPlaneState) {
  return sortByNewest(state.orchestration.runs);
}

export function listAutonomousRunEvents(
  state: ControlPlaneState,
  runId?: string | null
) {
  const events = runId
    ? state.orchestration.runEvents.filter((candidate) => candidate.runId === runId)
    : state.orchestration.runEvents;
  return sortByNewest(events);
}

export function ensureAutonomousRunRecord(
  draft: ControlPlaneState,
  initiative: InitiativeRecord
) {
  const existing = findAutonomousRunByInitiativeId(draft, initiative.id);
  if (existing) {
    return existing;
  }

  const run: AutonomousRunRecord = {
    id: buildOrchestrationId("run"),
    initiativeId: initiative.id,
    title: initiative.title,
    originalPrompt: initiative.userRequest,
    entryMode: "shell_chat",
    currentStage: "specing",
    health: "healthy",
    automationMode: "autonomous",
    manualStageProgression: false,
    operatorOverrideActive: false,
    previewStatus: "none",
    handoffStatus: "none",
    createdAt: initiative.createdAt,
    updatedAt: initiative.updatedAt,
    completedAt: null,
  };

  draft.orchestration.runs = [run, ...draft.orchestration.runs];
  return run;
}

export function updateAutonomousRunStage(
  draft: ControlPlaneState,
  initiativeId: string,
  patch: {
    stage?: AutonomousRunStage;
    health?: AutonomousRunHealth;
    previewStatus?: AutonomousRunRecord["previewStatus"];
    handoffStatus?: AutonomousRunRecord["handoffStatus"];
    operatorOverrideActive?: boolean;
    completedAt?: string | null;
    title?: string;
  }
) {
  let updated: AutonomousRunRecord | null = null;
  const occurredAt = nowIso();

  draft.orchestration.runs = draft.orchestration.runs.map((candidate) => {
    if (candidate.initiativeId !== initiativeId) {
      return candidate;
    }

    const next: AutonomousRunRecord = {
      ...candidate,
      title: patch.title ?? candidate.title,
      currentStage: patch.stage ?? candidate.currentStage,
      health: patch.health ?? candidate.health,
      previewStatus: patch.previewStatus ?? candidate.previewStatus,
      handoffStatus: patch.handoffStatus ?? candidate.handoffStatus,
      operatorOverrideActive:
        patch.operatorOverrideActive ?? candidate.operatorOverrideActive,
      completedAt:
        patch.completedAt === undefined ? candidate.completedAt ?? null : patch.completedAt,
      updatedAt: occurredAt,
    };
    updated = next;
    return next;
  });

  return updated;
}

export function appendAutonomousRunEvent(
  draft: ControlPlaneState,
  initiativeId: string,
  params: {
    kind: string;
    stage?: AutonomousRunStage | null;
    summary: string;
    payload?: Record<string, unknown>;
  }
) {
  const run = findAutonomousRunByInitiativeId(draft, initiativeId);
  if (!run) {
    return null;
  }

  const event: AutonomousRunEventRecord = {
    id: buildOrchestrationId("run-event"),
    runId: run.id,
    initiativeId,
    kind: params.kind,
    stage: params.stage ?? null,
    summary: params.summary,
    payload: params.payload ?? {},
    createdAt: nowIso(),
  };

  draft.orchestration.runEvents = [event, ...draft.orchestration.runEvents];
  return event;
}

export function upsertSpecDocRecord(
  draft: ControlPlaneState,
  initiativeId: string,
  brief: ProjectBriefRecord,
  artifactPath: string
) {
  const run = findAutonomousRunByInitiativeId(draft, initiativeId);
  if (!run) {
    return null;
  }

  const existing =
    draft.orchestration.specDocs.find((candidate) => candidate.briefId === brief.id) ?? null;
  const occurredAt = nowIso();
  const next: AutonomousSpecDocRecord = {
    id: existing?.id ?? buildOrchestrationId("spec"),
    runId: run.id,
    initiativeId,
    briefId: brief.id,
    status: brief.status === "approved" ? "ready" : existing?.status ?? "draft",
    summary: brief.summary,
    goals: [...brief.goals],
    nonGoals: [...brief.nonGoals],
    constraints: [...brief.constraints],
    assumptions: [...brief.assumptions],
    acceptanceCriteria: [...brief.acceptanceCriteria],
    deliverables: [...brief.deliverables],
    clarifications: [...brief.clarificationLog],
    artifactPath,
    createdAt: existing?.createdAt ?? occurredAt,
    updatedAt: occurredAt,
  };

  draft.orchestration.specDocs = [
    next,
    ...draft.orchestration.specDocs.filter((candidate) => candidate.id !== next.id),
  ];
  return next;
}

export function upsertAgentSessionRecord(
  draft: ControlPlaneState,
  initiativeId: string,
  params: {
    batchId: string;
    workItemId: string;
    attemptId: string;
    status: AutonomousAgentSessionRecord["status"];
    runtimeRef?: string | null;
    finishedAt?: string | null;
  }
) {
  const run = findAutonomousRunByInitiativeId(draft, initiativeId);
  if (!run) {
    return null;
  }

  const existing =
    draft.orchestration.agentSessions.find(
      (candidate) => candidate.attemptId === params.attemptId
    ) ?? null;
  const occurredAt = nowIso();
  const next: AutonomousAgentSessionRecord = {
    id: existing?.id ?? buildOrchestrationId("agent-session"),
    runId: run.id,
    batchId: params.batchId,
    workItemId: params.workItemId,
    attemptId: params.attemptId,
    agentKind: "worker",
    status: params.status,
    runtimeRef: params.runtimeRef ?? existing?.runtimeRef ?? null,
    startedAt: existing?.startedAt ?? occurredAt,
    finishedAt: params.finishedAt ?? existing?.finishedAt ?? null,
  };

  draft.orchestration.agentSessions = [
    next,
    ...draft.orchestration.agentSessions.filter((candidate) => candidate.id !== next.id),
  ];
  return next;
}

export function upsertPreviewTargetRecord(
  draft: ControlPlaneState,
  initiativeId: string,
  params: {
    previewId?: string;
    deliveryId: string;
    sourcePath: string;
    launchCommand?: string | null;
    healthStatus: AutonomousPreviewTargetRecord["healthStatus"];
  }
) {
  const run = findAutonomousRunByInitiativeId(draft, initiativeId);
  if (!run) {
    return null;
  }

  const existing =
    draft.orchestration.previewTargets.find(
      (candidate) => candidate.deliveryId === params.deliveryId
    ) ?? null;
  const occurredAt = nowIso();
  const next: AutonomousPreviewTargetRecord = {
    id: existing?.id ?? params.previewId ?? buildOrchestrationId("preview"),
    runId: run.id,
    deliveryId: params.deliveryId,
    mode: "local",
    url: `${resolveShellPublicOriginForLaunch()}/api/control/orchestration/previews/${existing?.id ?? ""}`,
    healthStatus: params.healthStatus,
    launchCommand: params.launchCommand ?? null,
    sourcePath: params.sourcePath,
    createdAt: existing?.createdAt ?? occurredAt,
    updatedAt: occurredAt,
  };

  next.url = `${resolveShellPublicOriginForLaunch()}/api/control/orchestration/previews/${next.id}`;
  draft.orchestration.previewTargets = [
    next,
    ...draft.orchestration.previewTargets.filter((candidate) => candidate.id !== next.id),
  ];
  return next;
}

export function upsertHandoffPacketRecord(
  draft: ControlPlaneState,
  initiativeId: string,
  params: {
    deliveryId: string;
    rootPath: string;
    finalSummaryPath: string;
    manifestPath: string;
    status: AutonomousHandoffPacketRecord["status"];
  }
) {
  const run = findAutonomousRunByInitiativeId(draft, initiativeId);
  if (!run) {
    return null;
  }

  const existing =
    draft.orchestration.handoffPackets.find(
      (candidate) => candidate.deliveryId === params.deliveryId
    ) ?? null;
  const occurredAt = nowIso();
  const next: AutonomousHandoffPacketRecord = {
    id: existing?.id ?? buildOrchestrationId("handoff-packet"),
    runId: run.id,
    deliveryId: params.deliveryId,
    status: params.status,
    rootPath: params.rootPath,
    finalSummaryPath: params.finalSummaryPath,
    manifestPath: params.manifestPath,
    createdAt: existing?.createdAt ?? occurredAt,
    updatedAt: occurredAt,
  };

  draft.orchestration.handoffPackets = [
    next,
    ...draft.orchestration.handoffPackets.filter((candidate) => candidate.id !== next.id),
  ];
  return next;
}

export function upsertValidationProofRecord(
  draft: ControlPlaneState,
  initiativeId: string,
  params: {
    autonomousOnePrompt: boolean;
    manualStageProgression: boolean;
    previewReady: boolean;
    launchReady: boolean;
    handoffReady: boolean;
    launchManifestPath?: string | null;
    launchProofUrl?: string | null;
    eventTimelinePath: string;
    finalSummaryPath: string;
  }
) {
  const run = findAutonomousRunByInitiativeId(draft, initiativeId);
  if (!run) {
    return null;
  }

  const existing =
    draft.orchestration.validationProofs.find((candidate) => candidate.runId === run.id) ?? null;
  const next: AutonomousValidationProofRecord = {
    id: existing?.id ?? buildOrchestrationId("validation-proof"),
    runId: run.id,
    autonomousOnePrompt: params.autonomousOnePrompt,
    manualStageProgression: params.manualStageProgression,
    previewReady: params.previewReady,
    launchReady: params.launchReady,
    handoffReady: params.handoffReady,
    launchManifestPath: params.launchManifestPath ?? null,
    launchProofUrl: params.launchProofUrl ?? null,
    eventTimelinePath: params.eventTimelinePath,
    finalSummaryPath: params.finalSummaryPath,
    generatedAt: nowIso(),
  };

  draft.orchestration.validationProofs = [
    next,
    ...draft.orchestration.validationProofs.filter((candidate) => candidate.id !== next.id),
  ];
  writeJson(
    path.join(resolveAutonomousRunRoot(run.id), "validation", "autonomous-proof.json"),
    next
  );
  return next;
}

export function materializeIntakeEvidence(run: AutonomousRunRecord, initiative: InitiativeRecord) {
  const root = resolveAutonomousRunRoot(run.id);
  const runPath = path.join(root, "intake", "run.json");
  const initiativePath = path.join(root, "intake", "initiative.json");
  const promptPath = path.join(root, "intake", "prompt.md");
  writeJson(runPath, run);
  writeJson(initiativePath, initiative);
  writeText(promptPath, `${initiative.userRequest.trim()}\n`);
  return { runPath, initiativePath, promptPath };
}

export function materializeSpecEvidence(
  run: AutonomousRunRecord,
  brief: ProjectBriefRecord
) {
  const root = resolveAutonomousRunRoot(run.id);
  const specJsonPath = path.join(root, "specing", "spec.json");
  const specMdPath = path.join(root, "specing", "spec.md");
  const clarificationsPath = path.join(root, "specing", "clarifications.json");
  writeJson(specJsonPath, {
    summary: brief.summary,
    goals: brief.goals,
    nonGoals: brief.nonGoals,
    constraints: brief.constraints,
    assumptions: brief.assumptions,
    acceptanceCriteria: brief.acceptanceCriteria,
    deliverables: brief.deliverables,
    status: brief.status,
  });
  writeText(
    specMdPath,
    [
      `# ${brief.summary}`,
      "",
      "## Goals",
      ...(brief.goals.length > 0 ? brief.goals.map((item) => `- ${item}`) : ["- n/a"]),
      "",
      "## Non-goals",
      ...(brief.nonGoals.length > 0 ? brief.nonGoals.map((item) => `- ${item}`) : ["- n/a"]),
      "",
      "## Constraints",
      ...(brief.constraints.length > 0
        ? brief.constraints.map((item) => `- ${item}`)
        : ["- n/a"]),
      "",
      "## Acceptance Criteria",
      ...(brief.acceptanceCriteria.length > 0
        ? brief.acceptanceCriteria.map((item) => `- ${item}`)
        : ["- n/a"]),
    ].join("\n")
  );
  writeJson(clarificationsPath, brief.clarificationLog);
  return { specJsonPath, specMdPath, clarificationsPath };
}

export function materializePlanningEvidence(
  run: AutonomousRunRecord,
  taskGraph: TaskGraphRecord,
  workUnits: readonly WorkUnitRecord[],
  batches: readonly ExecutionBatchRecord[]
) {
  const root = resolveAutonomousRunRoot(run.id);
  const taskGraphPath = path.join(root, "planning", "task-graph.json");
  const batchesPath = path.join(root, "planning", "batches.json");
  const notesPath = path.join(root, "planning", "planning-notes.md");
  writeJson(taskGraphPath, taskGraph);
  writeJson(batchesPath, {
    plannedBatches: batches.map((batch) => ({
      id: batch.id,
      workUnitIds: batch.workUnitIds,
      concurrencyLimit: batch.concurrencyLimit,
      status: batch.status,
    })),
    nextRunnableWorkUnitIds: workUnits
      .filter((workUnit) => workUnit.status === "ready")
      .map((workUnit) => workUnit.id),
  });
  writeText(
    notesPath,
    [
      `# Planning ${taskGraph.id}`,
      "",
      `Nodes: ${taskGraph.nodeIds.length}`,
      `Work items: ${workUnits.length}`,
      `Existing batches: ${batches.length}`,
      "",
      "The shell keeps the existing dependency-aware task graph and batch model.",
    ].join("\n")
  );
  return { taskGraphPath, batchesPath, notesPath };
}

export function materializeExecutionEvidence(
  run: AutonomousRunRecord,
  batch: ExecutionBatchRecord,
  workUnits: readonly WorkUnitRecord[],
  agentSessions: readonly AutonomousAgentSessionRecord[]
) {
  const root = resolveAutonomousRunRoot(run.id);
  const batchPath = path.join(root, "executing", "batch-result", `${batch.id}.json`);
  writeJson(batchPath, {
    batch,
    workUnits,
    agentSessions,
  });

  const workItemPaths = workUnits.map((workUnit) => {
    const workItemPath = path.join(root, "executing", "work-item", `${workUnit.id}.json`);
    writeJson(workItemPath, workUnit);
    return workItemPath;
  });

  const agentSessionPaths = agentSessions.map((agentSession) => {
    const agentSessionPath = path.join(
      root,
      "executing",
      "agent-session",
      `${agentSession.id}.json`
    );
    writeJson(agentSessionPath, agentSession);
    return agentSessionPath;
  });

  return { batchPath, workItemPaths, agentSessionPaths };
}

export function materializeAssemblyEvidence(
  run: AutonomousRunRecord,
  assembly: AssemblyRecord
) {
  const root = resolveAutonomousRunRoot(run.id);
  const assemblyJsonPath = path.join(root, "assembling", "assembly.json");
  const summaryPath = path.join(root, "assembling", "assembly-summary.md");
  const manifestMirrorPath = path.join(root, "assembling", "artifact-manifest.json");
  writeJson(assemblyJsonPath, assembly);
  writeText(
    summaryPath,
    `# Assembly ${assembly.id}\n\n${assembly.summary}\n\nOutput: ${assembly.outputLocation ?? "n/a"}\n`
  );
  writeJson(manifestMirrorPath, {
    manifestPath: assembly.manifestPath ?? null,
    artifactUris: assembly.artifactUris,
    inputWorkUnitIds: assembly.inputWorkUnitIds,
  });
  return { assemblyJsonPath, summaryPath, manifestMirrorPath };
}

export function materializeVerificationEvidence(
  run: AutonomousRunRecord,
  verification: VerificationRunRecord
) {
  const root = resolveAutonomousRunRoot(run.id);
  const verificationJsonPath = path.join(root, "verifying", "verification.json");
  const reportPath = path.join(root, "verifying", "verification-report.md");
  const checksDir = path.join(root, "verifying", "checks");
  writeJson(verificationJsonPath, verification);
  writeText(
    reportPath,
    [
      `# Verification ${verification.id}`,
      "",
      `Status: ${verification.overallStatus}`,
      "",
      ...verification.checks.map((check) => `- ${check.name}: ${check.status}`),
    ].join("\n")
  );
  verification.checks.forEach((check) => {
    writeJson(path.join(checksDir, `${check.name}.json`), check);
  });
  return { verificationJsonPath, reportPath, checksDir };
}

export function materializeDeliveryEvidence(
  run: AutonomousRunRecord,
  delivery: DeliveryRecord,
  preview: AutonomousPreviewTargetRecord,
  handoff: AutonomousHandoffPacketRecord
) {
  const root = resolveAutonomousRunRoot(run.id);
  const deliveryJsonPath = path.join(root, "delivering", "delivery.json");
  const previewJsonPath = path.join(root, "delivering", "preview.json");
  const finalSummaryPath = path.join(root, "delivering", "handoff", "final-summary.md");
  const manifestPath = path.join(root, "delivering", "handoff", "manifest.json");
  writeJson(deliveryJsonPath, delivery);
  writeJson(previewJsonPath, preview);
  writeText(
    finalSummaryPath,
    [
      `# Final Summary ${delivery.id}`,
      "",
      delivery.resultSummary,
      "",
      `Preview: ${preview.url}`,
      `Local output: ${delivery.localOutputPath ?? "n/a"}`,
    ].join("\n")
  );
  writeJson(manifestPath, {
    deliveryId: delivery.id,
    previewTargetId: preview.id,
    handoffPacketId: handoff.id,
    rootPath: handoff.rootPath,
  });
  return { deliveryJsonPath, previewJsonPath, finalSummaryPath, manifestPath };
}

export function syncAutonomousRunTimeline(
  state: ControlPlaneState,
  initiativeId: string
) {
  const run = findAutonomousRunByInitiativeId(state, initiativeId);
  if (!run) {
    return null;
  }

  const events = listAutonomousRunEvents(state, run.id);
  const timelinePath = path.join(resolveAutonomousRunRoot(run.id), "event-timeline.jsonl");
  const lines = [...events]
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    .map((event) => JSON.stringify(event));
  writeText(timelinePath, `${lines.join("\n")}\n`);
  return timelinePath;
}

export function buildAutonomousValidationProof(
  state: ControlPlaneState,
  initiativeId: string
) {
  const run = findAutonomousRunByInitiativeId(state, initiativeId);
  if (!run) {
    return null;
  }

  const preview =
    state.orchestration.previewTargets.find((candidate) => candidate.runId === run.id) ?? null;
  const handoff =
    state.orchestration.handoffPackets.find((candidate) => candidate.runId === run.id) ?? null;
  const delivery =
    state.orchestration.deliveries.find((candidate) => candidate.initiativeId === initiativeId) ??
    null;
  const eventTimelinePath = syncAutonomousRunTimeline(state, initiativeId);
  if (!eventTimelinePath || !handoff || !delivery) {
    return null;
  }

  const latestBrief =
    [...state.orchestration.briefs]
      .filter((candidate) => candidate.initiativeId === initiativeId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null;
  const autonomousOnePrompt =
    run.entryMode === "shell_chat" &&
    run.automationMode === "autonomous" &&
    latestBrief?.authoredBy?.trim() === AUTONOMOUS_PROOF_BRIEF_AUTHOR;
  const manualStageProgression = run.manualStageProgression || !autonomousOnePrompt;

  return {
    autonomousOnePrompt,
    manualStageProgression,
    previewReady: preview?.healthStatus === "ready",
    launchReady:
      delivery.launchProofKind === "runnable_result" &&
      Boolean(delivery.launchProofAt && delivery.launchManifestPath),
    handoffReady: handoff.status === "ready",
    launchManifestPath: delivery.launchManifestPath ?? null,
    launchProofUrl: delivery.launchProofUrl ?? null,
    eventTimelinePath,
    finalSummaryPath: handoff.finalSummaryPath,
  };
}

export function buildPreviewSourcePath(delivery: DeliveryRecord) {
  return path.join(delivery.localOutputPath ?? "", "preview.html");
}

export function buildAutonomousDeliveryLinks(
  delivery: DeliveryRecord,
  preview: AutonomousPreviewTargetRecord,
  handoff: AutonomousHandoffPacketRecord
) {
  return {
    deliveryPath: relativeToRunRoot(preview.runId, path.join(resolveAutonomousRunRoot(preview.runId), "delivering", "delivery.json")),
    previewPath: relativeToRunRoot(preview.runId, preview.sourcePath),
    handoffManifestPath: relativeToRunRoot(preview.runId, handoff.manifestPath),
    localOutputPath: delivery.localOutputPath ?? null,
  };
}
