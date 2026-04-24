import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  AssembliesDirectoryResponse,
  AssemblyMutationResponse,
  AssemblyRecord,
  CreateAssemblyRequest,
  TaskGraphRecord,
  WorkUnitRecord,
} from "../control-plane/contracts/orchestration";
import { readControlPlaneState, updateControlPlaneState } from "../control-plane/state/store";
import {
  appendAutonomousRunEvent,
  findAutonomousRunByInitiativeId,
  materializeAssemblyEvidence,
  syncAutonomousRunTimeline,
  updateAutonomousRunStage,
} from "./autonomous-run";
import {
  resolveArtifactStore,
  resolveInfinityRoot,
  storeJsonArtifact,
  storeTextArtifact,
  writeSignedArtifactManifest,
  type StoredArtifact,
} from "./artifacts";

import { listOrchestrationTaskGraphs } from "./task-graphs";
import { listOrchestrationWorkUnits } from "./work-units";
import { buildOrchestrationDirectoryMeta, buildOrchestrationId, nowIso, sortByUpdatedAtDesc } from "./shared";

function cloneAssembly(value: AssemblyRecord) {
  return JSON.parse(JSON.stringify(value)) as AssemblyRecord;
}

async function latestTaskGraphForInitiative(initiativeId: string) {
  const taskGraphs = await listOrchestrationTaskGraphs({ initiativeId });
  return taskGraphs[0] ?? null;
}

async function workUnitsForTaskGraph(taskGraphId: string) {
  return sortByUpdatedAtDesc(await listOrchestrationWorkUnits({ taskGraphId }));
}

function sortedWorkUnitIds(workUnits: readonly WorkUnitRecord[]) {
  return [...workUnits].map((workUnit) => workUnit.id).sort((left, right) =>
    left.localeCompare(right)
  );
}

function assemblyOutputLocation(initiativeId: string, taskGraphId: string) {
  return path.join(
    resolveInfinityRoot(),
    ".local-state",
    "orchestration",
    "assemblies",
    initiativeId,
    taskGraphId
  );
}

function assemblyArtifactPrefix(initiativeId: string, taskGraphId: string) {
  return `assemblies/${initiativeId}/${taskGraphId}`;
}

async function writeAssemblyPackage(
  initiativeId: string,
  taskGraph: TaskGraphRecord,
  workUnits: readonly WorkUnitRecord[]
) {
  const store = resolveArtifactStore();
  const localOutputLocation = assemblyOutputLocation(initiativeId, taskGraph.id);
  const artifactPrefix = assemblyArtifactPrefix(initiativeId, taskGraph.id);
  const outputLocation =
    store.mode === "local" ? localOutputLocation : store.uriForKey(artifactPrefix);
  const workUnitsDirectory = path.join(localOutputLocation, "work-units");
  await mkdir(workUnitsDirectory, { recursive: true });
  const storedArtifacts: StoredArtifact[] = [];

  const artifacts = await Promise.all(
    workUnits.map(async (workUnit) => {
      const attemptId = workUnit.latestAttemptId ?? `attempt-missing-${workUnit.id}`;
      const artifactPath = path.join(
        workUnitsDirectory,
        `${attemptId}.json`
      );
      await writeFile(
        artifactPath,
        JSON.stringify(
          {
            initiativeId,
            taskGraphId: taskGraph.id,
            workUnitId: workUnit.id,
            attemptId,
            title: workUnit.title,
            description: workUnit.description,
            latestAttemptId: workUnit.latestAttemptId ?? null,
            scopePaths: workUnit.scopePaths,
            acceptanceCriteria: workUnit.acceptanceCriteria,
          },
          null,
          2
        )
      );
      const stored = storeJsonArtifact({
        key: `${artifactPrefix}/work-units/${attemptId}.json`,
        payload: {
          initiativeId,
          taskGraphId: taskGraph.id,
          workUnitId: workUnit.id,
          attemptId,
          title: workUnit.title,
          description: workUnit.description,
          latestAttemptId: workUnit.latestAttemptId ?? null,
          scopePaths: workUnit.scopePaths,
          acceptanceCriteria: workUnit.acceptanceCriteria,
        },
      });
      storedArtifacts.push(stored);
      return {
        attemptId,
        artifactPath: store.mode === "local" ? artifactPath : stored.uri,
        artifactUri: stored.uri,
      };
    })
  );

  const manifestPath = path.join(localOutputLocation, "assembly-manifest.json");
  const manifest = {
    initiativeId,
    taskGraphId: taskGraph.id,
    generatedAt: nowIso(),
    workUnitIds: sortedWorkUnitIds(workUnits),
    attemptIds: artifacts.map((artifact) => artifact.attemptId),
    artifactUris: artifacts.map((artifact) => artifact.artifactUri),
    artifacts: artifacts.map((artifact) => ({
      attemptId: artifact.attemptId,
      artifactPath: artifact.artifactPath,
      artifactUri: artifact.artifactUri,
    })),
    sourceSummaries: workUnits.map((workUnit) => ({
      workUnitId: workUnit.id,
      title: workUnit.title,
      scopePaths: workUnit.scopePaths,
    })),
    verificationPrerequisites: [
      "assembly_present",
      "work_units_completed",
      "assembly_matches_task_graph",
      "artifact_manifest_complete",
      "static_checks_passed",
      "targeted_tests_passed",
    ],
  };
  await writeFile(
    manifestPath,
    JSON.stringify(manifest, null, 2)
  );
  const storedManifest = storeJsonArtifact({
    key: `${artifactPrefix}/assembly-manifest.json`,
    payload: manifest,
  });
  storedArtifacts.push(storedManifest);

  const readme = [
    `# Assembly ${taskGraph.id}`,
    "",
    "This directory is a local handoff package generated by the shell orchestration slice.",
    "It captures completed work-unit evidence and should be reviewed before any manual publish or release step.",
    "",
    `Work units: ${workUnits.length}`,
    `Artifacts: ${artifacts.length}`,
  ].join("\n");
  await writeFile(path.join(localOutputLocation, "README.md"), readme);
  const storedReadme = storeTextArtifact({
    key: `${artifactPrefix}/README.md`,
    content: readme,
    contentType: "text/markdown; charset=utf-8",
  });
  storedArtifacts.push(storedReadme);

  const signedManifest = writeSignedArtifactManifest({
    key: `${artifactPrefix}/signed-artifact-manifest.json`,
    subject: {
      kind: "assembly",
      initiativeId,
      taskGraphId: taskGraph.id,
    },
    artifacts: storedArtifacts,
  });

  return {
    artifactUris: artifacts
      .map((artifact) => artifact.artifactUri)
      .sort((left, right) => left.localeCompare(right)),
    manifestPath: store.mode === "local" ? manifestPath : signedManifest.stored.uri,
    outputLocation,
  };
}

function arraysEqual(left: readonly string[], right: readonly string[]) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

export async function listAssemblies(filters?: { initiativeId?: string | null }) {
  const state = await readControlPlaneState();
  return sortByUpdatedAtDesc(
    state.orchestration.assemblies.filter((assembly) => {
      if (filters?.initiativeId && assembly.initiativeId !== filters.initiativeId) {
        return false;
      }
      return true;
    })
  ).map(cloneAssembly);
}

export async function buildAssembliesDirectoryResponse(filters?: {
  initiativeId?: string | null;
}): Promise<AssembliesDirectoryResponse> {
  return {
    ...(await buildOrchestrationDirectoryMeta([
      "Assemblies are derived from completed work units in the shell-owned orchestration slice.",
    ])),
    assemblies: await listAssemblies(filters),
  };
}

export async function createAssembly(input: CreateAssemblyRequest): Promise<AssemblyMutationResponse | null> {
  const taskGraph = await latestTaskGraphForInitiative(input.initiativeId);
  if (!taskGraph) {
    return null;
  }

  const workUnits = await workUnitsForTaskGraph(taskGraph.id);
  if (workUnits.length === 0 || workUnits.some((workUnit) => workUnit.status !== "completed")) {
    return null;
  }
  if (
    workUnits.some(
      (workUnit) =>
        typeof workUnit.latestAttemptId !== "string" || workUnit.latestAttemptId.length === 0
    )
  ) {
    return null;
  }

  const expectedWorkUnitIds = sortedWorkUnitIds(workUnits);

  const existing = (await listAssemblies({ initiativeId: input.initiativeId }))[0];
  if (
    existing &&
    arraysEqual([...existing.inputWorkUnitIds].sort((left, right) => left.localeCompare(right)), expectedWorkUnitIds) &&
    existing.taskGraphId === taskGraph.id
  ) {
    return {
      ...(await buildOrchestrationDirectoryMeta([
        `Assembly ${existing.id} already exists for initiative ${input.initiativeId}.`,
      ])),
      assembly: existing,
      taskGraph,
      workUnits,
    };
  }

  const occurredAt = nowIso();
  const assemblyId = buildOrchestrationId("assembly");
  const assemblyPackage = await writeAssemblyPackage(input.initiativeId, taskGraph, workUnits);
  const assembly: AssemblyRecord = {
    id: assemblyId,
    initiativeId: input.initiativeId,
    taskGraphId: taskGraph.id,
    inputWorkUnitIds: expectedWorkUnitIds,
    artifactUris: assemblyPackage.artifactUris,
    outputLocation: assemblyPackage.outputLocation,
    manifestPath: assemblyPackage.manifestPath,
    summary: `Local assembly package with ${workUnits.length} completed work-unit evidence file(s).`,
    status: "assembled",
    createdAt: occurredAt,
    updatedAt: occurredAt,
  };

  await updateControlPlaneState((draft) => {
    draft.orchestration.assemblies = [assembly, ...draft.orchestration.assemblies];
    draft.orchestration.initiatives = draft.orchestration.initiatives.map((initiative) =>
      initiative.id === input.initiativeId
        ? {
            ...initiative,
            status: "assembly",
            updatedAt: occurredAt,
          }
        : initiative
    );
    updateAutonomousRunStage(draft, input.initiativeId, {
      stage: "assembling",
      health: "healthy",
    });
    appendAutonomousRunEvent(draft, input.initiativeId, {
      kind: "assembly.started",
      stage: "assembling",
      summary: `Assembly ${assembly.id} started.`,
      payload: {
        assemblyId: assembly.id,
        taskGraphId: taskGraph.id,
      },
    });
    appendAutonomousRunEvent(draft, input.initiativeId, {
      kind: "assembly.ready",
      stage: "assembling",
      summary: `Assembly ${assembly.id} is ready.`,
      payload: {
        assemblyId: assembly.id,
        taskGraphId: taskGraph.id,
      },
    });
  });

  const nextState = await readControlPlaneState();
  const run = findAutonomousRunByInitiativeId(nextState, input.initiativeId);
  if (run) {
    materializeAssemblyEvidence(run, assembly);
    syncAutonomousRunTimeline(nextState, input.initiativeId);
  }

  return {
    ...(await buildOrchestrationDirectoryMeta([
      `Assembly ${assembly.id} was created from completed work units for initiative ${input.initiativeId}.`,
    ])),
    assembly,
    taskGraph: taskGraph as TaskGraphRecord,
    workUnits: workUnits as WorkUnitRecord[],
  };
}
