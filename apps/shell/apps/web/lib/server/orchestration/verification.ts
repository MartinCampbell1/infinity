import path from "node:path";

import type {
  AssemblyRecord,
  CreateVerificationRequest,
  InitiativeRecord,
  TaskGraphRecord,
  VerificationCheck,
  VerificationMutationResponse,
  VerificationRunRecord,
  VerificationRunsDirectoryResponse,
  WorkUnitRecord,
} from "../control-plane/contracts/orchestration";
import type { RecoveryIncident } from "../control-plane/contracts/recoveries";
import type { ControlPlaneState } from "../control-plane/state/types";
import { readControlPlaneState, updateControlPlaneState } from "../control-plane/state/store";
import {
  appendAutonomousRunEvent,
  findAutonomousRunByInitiativeId,
  materializeVerificationEvidence,
  syncAutonomousRunTimeline,
  updateAutonomousRunStage,
} from "./autonomous-run";
import { artifactEvidenceExists } from "./artifacts";

import { listAssemblies } from "./assembly";
import { listOrchestrationTaskGraphs } from "./task-graphs";
import { runValidationChecks } from "./validation";
import { listOrchestrationWorkUnits } from "./work-units";
import { buildOrchestrationDirectoryMeta, buildOrchestrationId, nowIso, sortByUpdatedAtDesc } from "./shared";

function cloneVerification(value: VerificationRunRecord) {
  return JSON.parse(JSON.stringify(value)) as VerificationRunRecord;
}

async function latestTaskGraphForInitiative(initiativeId: string) {
  const taskGraphs = await listOrchestrationTaskGraphs({ initiativeId });
  return taskGraphs[0] ?? null;
}

async function latestAssemblyForInitiative(initiativeId: string) {
  const assemblies = await listAssemblies({ initiativeId });
  return assemblies[0] ?? null;
}

async function workUnitsForTaskGraph(taskGraphId: string) {
  return sortByUpdatedAtDesc(await listOrchestrationWorkUnits({ taskGraphId }));
}

export async function listVerifications(filters?: { initiativeId?: string | null }) {
  const state = await readControlPlaneState();
  return [...state.orchestration.verifications]
    .filter((verification) => {
      if (filters?.initiativeId && verification.initiativeId !== filters.initiativeId) {
        return false;
      }
      return true;
    })
    .sort((left, right) => {
      const leftAt = left.finishedAt ?? left.startedAt ?? left.id;
      const rightAt = right.finishedAt ?? right.startedAt ?? right.id;
      return rightAt.localeCompare(leftAt);
    })
    .map(cloneVerification);
}

export async function buildVerificationsDirectoryResponse(filters?: {
  initiativeId?: string | null;
}): Promise<VerificationRunsDirectoryResponse> {
  return {
    ...(await buildOrchestrationDirectoryMeta([
      "Verification runs are shell-owned and block delivery creation on failure.",
    ])),
    verifications: await listVerifications(filters),
  };
}

function arraysEqual(left: readonly string[], right: readonly string[]) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

async function buildChecks(
  assembly: AssemblyRecord | null,
  workUnits: readonly WorkUnitRecord[],
  assemblyMatchesGraph: boolean
): Promise<VerificationCheck[]> {
  const manifestPath =
    assembly?.manifestPath ??
    (assembly?.outputLocation
      ? path.join(assembly.outputLocation, "assembly-manifest.json")
      : null);
  const manifestPresent = manifestPath ? artifactEvidenceExists(manifestPath) : false;
  const artifactEvidencePresent =
    !!assembly &&
    assembly.artifactUris.length === workUnits.length &&
    assembly.artifactUris.every((artifactUri) => artifactEvidenceExists(artifactUri));

  const checks: VerificationCheck[] = [
    {
      name: "assembly_present",
      status: assembly ? "passed" : "failed",
      details: assembly ? `Assembly ${assembly.id} is present.` : "Assembly is missing.",
    },
    {
      name: "work_units_completed",
      status:
        workUnits.length > 0 && workUnits.every((workUnit) => workUnit.status === "completed")
          ? "passed"
          : "failed",
      details:
        workUnits.length > 0 && workUnits.every((workUnit) => workUnit.status === "completed")
          ? "All work units are completed."
          : "Not every work unit is completed.",
    },
    {
      name: "assembly_matches_task_graph",
      status: assembly && assemblyMatchesGraph ? "passed" : "failed",
      details:
        assembly && assemblyMatchesGraph
          ? "Assembly is tied to the current task graph generation."
          : "Assembly does not match the current task graph generation.",
      },
    {
      name: "assembly_manifest_present",
      status: manifestPresent ? "passed" : "failed",
      details: manifestPresent
        ? "Assembly manifest is present."
        : "Assembly manifest is missing.",
      artifactPath: manifestPath,
    },
    {
      name: "artifact_evidence_present",
      status: artifactEvidencePresent ? "passed" : "failed",
      details: artifactEvidencePresent
        ? `${assembly?.artifactUris.length ?? 0} artifact evidence file(s) are present.`
        : "Assembly artifact evidence files are missing or stale.",
      artifactPath: manifestPath,
    },
  ];

  const validationChecks = runValidationChecks(manifestPath);
  return [...checks, ...validationChecks.checks];
}

function summarizeFailedChecks(checks: readonly VerificationCheck[]) {
  const failedChecks = checks.filter((check) => check.status === "failed");
  if (failedChecks.length === 0) {
    return "Verification failed without a failed check payload.";
  }

  return failedChecks
    .map((check) => {
      const details = check.details ? `: ${check.details}` : "";
      const command = check.command ? ` Command: ${check.command}.` : "";
      const cwd = check.cwd ? ` Cwd: ${check.cwd}.` : "";
      const exitCode =
        typeof check.exitCode === "number" ? ` Exit: ${check.exitCode}.` : "";
      return `${check.name}${details}${command}${cwd}${exitCode}`;
    })
    .join("\n");
}

function upsertVerificationRecoveryIncident(
  state: ControlPlaneState,
  initiative: InitiativeRecord | null,
  verification: VerificationRunRecord,
  occurredAt: string
) {
  if (verification.overallStatus !== "failed") {
    return null;
  }

  const failedChecks = verification.checks.filter(
    (check) => check.status === "failed"
  );
  const recoveryId = `orchestration-recovery-${verification.id}`;
  const existingIndex = state.recoveries.incidents.findIndex(
    (incident) => incident.id === recoveryId
  );
  const existing =
    existingIndex >= 0 ? state.recoveries.incidents[existingIndex] ?? null : null;
  const incident: RecoveryIncident = {
    id: existing?.id ?? recoveryId,
    sessionId: initiative?.workspaceSessionId ?? verification.initiativeId,
    externalSessionId: null,
    projectId: verification.initiativeId,
    projectName: initiative?.title ?? verification.initiativeId,
    groupId: null,
    accountId: null,
    workspaceId: null,
    status: "retryable",
    severity: "high",
    recoveryActionKind: "retry",
    summary: `Verification ${verification.id} failed and blocked delivery.`,
    rootCause: summarizeFailedChecks(verification.checks),
    recommendedAction:
      "Inspect the failed verification checks, fix the run artifacts or state, then retry verification.",
    retryCount: existing?.retryCount ?? 0,
    openedAt: existing?.openedAt ?? occurredAt,
    lastObservedAt: occurredAt,
    updatedAt: occurredAt,
    resolvedAt: null,
    revision: existing ? existing.revision + 1 : 1,
    raw: {
      source: "orchestration.verification",
      verificationId: verification.id,
      initiativeId: verification.initiativeId,
      assemblyId: verification.assemblyId || null,
      failedChecks: failedChecks.map((check) => ({
        name: check.name,
        details: check.details ?? null,
        command: check.command ?? null,
        cwd: check.cwd ?? null,
        exitCode: check.exitCode ?? null,
        artifactPath: check.artifactPath ?? null,
        stdoutSnippet: check.stdoutSnippet ?? null,
        stderrSnippet: check.stderrSnippet ?? null,
      })),
    },
  };

  if (existingIndex >= 0) {
    state.recoveries.incidents[existingIndex] = incident;
  } else {
    state.recoveries.incidents = [incident, ...state.recoveries.incidents];
  }

  return incident;
}

export async function createVerification(
  input: CreateVerificationRequest
): Promise<VerificationMutationResponse | null> {
  const taskGraph = await latestTaskGraphForInitiative(input.initiativeId);
  if (!taskGraph) {
    return null;
  }

  const assembly = await latestAssemblyForInitiative(input.initiativeId);
  const workUnits = await workUnitsForTaskGraph(taskGraph.id);
  const expectedWorkUnitIds = [...workUnits].map((workUnit) => workUnit.id).sort((left, right) =>
    left.localeCompare(right)
  );
  const assemblyMatchesCurrentGraph =
    !!assembly &&
    assembly.taskGraphId === taskGraph.id &&
    arraysEqual(
      [...assembly.inputWorkUnitIds].sort((left, right) => left.localeCompare(right)),
      expectedWorkUnitIds
    );
  const checks = await buildChecks(assembly, workUnits, assemblyMatchesCurrentGraph);
  const overallStatus = checks.every((check) => check.status === "passed")
    ? "passed"
    : "failed";
  const occurredAt = nowIso();

  const verification: VerificationRunRecord = {
    id: buildOrchestrationId("verification"),
    initiativeId: input.initiativeId,
    assemblyId: assembly?.id ?? "",
    checks,
    overallStatus,
    startedAt: occurredAt,
    finishedAt: occurredAt,
  };

  await updateControlPlaneState((draft) => {
    const initiative =
      draft.orchestration.initiatives.find(
        (candidate) => candidate.id === input.initiativeId
      ) ?? null;
    draft.orchestration.verifications = [verification, ...draft.orchestration.verifications];
    draft.orchestration.initiatives = draft.orchestration.initiatives.map((initiative) =>
      initiative.id === input.initiativeId
        ? {
            ...initiative,
            status: overallStatus === "passed" ? "verifying" : "failed",
            updatedAt: occurredAt,
          }
        : initiative
    );
    updateAutonomousRunStage(draft, input.initiativeId, {
      stage: overallStatus === "passed" ? "delivering" : "blocked",
      health: overallStatus === "passed" ? "healthy" : "blocked",
    });
    appendAutonomousRunEvent(draft, input.initiativeId, {
      kind: "verification.started",
      stage: "verifying",
      summary: `Verification ${verification.id} started.`,
      payload: {
        verificationId: verification.id,
        assemblyId: verification.assemblyId,
      },
    });
    appendAutonomousRunEvent(draft, input.initiativeId, {
      kind: overallStatus === "passed" ? "verification.passed" : "verification.failed",
      stage: overallStatus === "passed" ? "delivering" : "blocked",
      summary:
        overallStatus === "passed"
          ? `Verification ${verification.id} passed.`
          : `Verification ${verification.id} failed.`,
      payload: {
        verificationId: verification.id,
        checks: verification.checks.map((check) => ({
          name: check.name,
          status: check.status,
        })),
      },
    });
    const recoveryIncident = upsertVerificationRecoveryIncident(
      draft,
      initiative,
      verification,
      occurredAt
    );
    if (recoveryIncident) {
      appendAutonomousRunEvent(draft, input.initiativeId, {
        kind: "recovery.opened",
        stage: "blocked",
        summary: `Recovery ${recoveryIncident.id} opened for failed verification ${verification.id}.`,
        payload: {
          recoveryId: recoveryIncident.id,
          verificationId: verification.id,
          status: recoveryIncident.status,
          recoveryActionKind: recoveryIncident.recoveryActionKind,
        },
      });
    }
  });

  const nextState = await readControlPlaneState();
  const run = findAutonomousRunByInitiativeId(nextState, input.initiativeId);
  if (run) {
    materializeVerificationEvidence(run, verification);
    syncAutonomousRunTimeline(nextState, input.initiativeId);
  }

  return {
    ...(await buildOrchestrationDirectoryMeta([
      `Verification ${verification.id} was created for initiative ${input.initiativeId}.`,
      overallStatus === "failed"
        ? "Delivery remains blocked because verification failed."
        : "Verification passed, but delivery is owned by the next phase.",
    ])),
    verification,
    assembly,
    taskGraph: taskGraph as TaskGraphRecord,
    workUnits: workUnits as WorkUnitRecord[],
    deliveryBlocked: overallStatus === "failed",
  };
}
