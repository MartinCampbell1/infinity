import { access } from "node:fs/promises";
import path from "node:path";

import type {
  AssemblyRecord,
  CreateVerificationRequest,
  TaskGraphRecord,
  VerificationCheck,
  VerificationMutationResponse,
  VerificationRunRecord,
  VerificationRunsDirectoryResponse,
  WorkUnitRecord,
} from "../control-plane/contracts/orchestration";
import { readControlPlaneState, updateControlPlaneState } from "../control-plane/state/store";
import {
  appendAutonomousRunEvent,
  findAutonomousRunByInitiativeId,
  materializeVerificationEvidence,
  syncAutonomousRunTimeline,
  updateAutonomousRunStage,
} from "./autonomous-run";

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

async function fileExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
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
  const manifestPresent = manifestPath ? await fileExists(manifestPath) : false;
  const artifactEvidencePresent =
    !!assembly &&
    assembly.artifactUris.length === workUnits.length &&
    (await Promise.all(
      assembly.artifactUris.map((artifactUri) =>
        artifactUri.startsWith("file://")
          ? fileExists(artifactUri.replace(/^file:\/\//, ""))
          : fileExists(artifactUri)
      )
    )).every(Boolean);

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
