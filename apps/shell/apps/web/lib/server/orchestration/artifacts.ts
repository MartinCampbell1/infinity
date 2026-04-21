import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type {
  AssemblyRecord,
  DeliveryRecord,
  TaskGraphRecord,
  VerificationRunRecord,
  WorkUnitRecord,
} from "../control-plane/contracts/orchestration";

import { nowIso } from "./shared";

const ORCHESTRATION_DIR = path.dirname(fileURLToPath(import.meta.url));

function trimTrailingSlash(value: string) {
  return value.replace(/[\\/]$/, "");
}

export function resolveInfinityRoot() {
  const explicitRoot = process.env.FOUNDEROS_INTEGRATION_ROOT;
  if (explicitRoot && explicitRoot.trim().length > 0) {
    return trimTrailingSlash(explicitRoot.trim());
  }

  return path.resolve(ORCHESTRATION_DIR, "../../../../../../..");
}

export function resolveOrchestrationArtifactsRoot() {
  const explicitRoot = process.env.FOUNDEROS_ORCHESTRATION_ARTIFACTS_ROOT;
  if (explicitRoot && explicitRoot.trim().length > 0) {
    return trimTrailingSlash(explicitRoot.trim());
  }

  return path.join(resolveInfinityRoot(), ".local-state", "assemblies");
}

export function resolveOrchestrationDeliveriesRoot() {
  const explicitRoot = process.env.FOUNDEROS_ORCHESTRATION_DELIVERIES_ROOT;
  if (explicitRoot && explicitRoot.trim().length > 0) {
    return trimTrailingSlash(explicitRoot.trim());
  }

  return path.join(resolveInfinityRoot(), ".local-state", "orchestration", "deliveries");
}

export function resolveAssemblyDirectory(initiativeId: string) {
  return path.join(resolveOrchestrationArtifactsRoot(), initiativeId);
}

type AssemblyArtifactRecord = {
  attemptId: string;
  workUnitId: string;
  title: string;
  scopePaths: string[];
  acceptanceCriteria: string[];
  generatedAt: string;
  artifactPath: string;
  artifactUri: string;
};

export function materializeAssemblyArtifacts(
  initiativeId: string,
  taskGraph: TaskGraphRecord,
  workUnits: readonly WorkUnitRecord[]
) {
  const assemblyDir = resolveAssemblyDirectory(initiativeId);
  const attemptsDir = path.join(assemblyDir, "attempts");
  mkdirSync(attemptsDir, { recursive: true });

  const generatedAt = nowIso();
  const artifacts = workUnits.map((workUnit) => {
    const attemptId = workUnit.latestAttemptId ?? `attempt-missing-${workUnit.id}`;
    const artifactPath = path.join(attemptsDir, `${attemptId}.json`);
    const payload = {
      initiativeId,
      taskGraphId: taskGraph.id,
      workUnitId: workUnit.id,
      attemptId,
      title: workUnit.title,
      description: workUnit.description,
      scopePaths: workUnit.scopePaths,
      acceptanceCriteria: workUnit.acceptanceCriteria,
      generatedAt,
    };
    writeFileSync(artifactPath, JSON.stringify(payload, null, 2));

    return {
      attemptId,
      workUnitId: workUnit.id,
      title: workUnit.title,
      scopePaths: [...workUnit.scopePaths],
      acceptanceCriteria: [...workUnit.acceptanceCriteria],
      generatedAt,
      artifactPath,
      artifactUri: `file://${artifactPath}`,
    } satisfies AssemblyArtifactRecord;
  });

  return {
    assemblyDir,
    generatedAt,
    artifacts,
  };
}

export function buildAssemblyManifest(params: {
  initiativeId: string;
  taskGraph: TaskGraphRecord;
  workUnits: readonly WorkUnitRecord[];
  artifacts: readonly AssemblyArtifactRecord[];
}) {
  return {
    initiativeId: params.initiativeId,
    taskGraphId: params.taskGraph.id,
    workUnitIds: params.workUnits.map((workUnit) => workUnit.id),
    attemptIds: params.artifacts.map((artifact) => artifact.attemptId),
    artifacts: params.artifacts.map((artifact) => ({
      attemptId: artifact.attemptId,
      workUnitId: artifact.workUnitId,
      title: artifact.title,
      artifactPath: artifact.artifactPath,
      artifactUri: artifact.artifactUri,
    })),
    generatedAt: params.artifacts[0]?.generatedAt ?? nowIso(),
    sourceSummaries: params.workUnits.map((workUnit) => ({
      workUnitId: workUnit.id,
      title: workUnit.title,
      scopePaths: workUnit.scopePaths,
    })),
    verificationPrerequisites: [
      "assembly_present",
      "work_units_completed",
      "assembly_matches_task_graph",
      "assembly_manifest_present",
      "artifact_evidence_present",
      "static_checks_passed",
      "targeted_tests_passed",
    ],
  };
}

export function writeAssemblyManifest(params: {
  initiativeId: string;
  taskGraph: TaskGraphRecord;
  workUnits: readonly WorkUnitRecord[];
  artifacts: readonly AssemblyArtifactRecord[];
}) {
  const assemblyDir = resolveAssemblyDirectory(params.initiativeId);
  mkdirSync(assemblyDir, { recursive: true });

  const manifestPath = path.join(assemblyDir, "assembly-manifest.json");
  const manifest = buildAssemblyManifest(params);
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  return {
    manifestPath,
    manifest,
  };
}

export function buildDeliveryManifest(params: {
  delivery: DeliveryRecord;
  assembly: AssemblyRecord;
  verification: VerificationRunRecord;
}) {
  return {
    deliveryId: params.delivery.id,
    initiativeId: params.delivery.initiativeId,
    taskGraphId: params.delivery.taskGraphId ?? params.assembly.taskGraphId,
    verificationRunId: params.delivery.verificationRunId,
    assemblyId: params.assembly.id,
    assemblyManifestPath: params.assembly.manifestPath ?? null,
    localOutputPath: params.delivery.localOutputPath ?? null,
    previewUrl: params.delivery.previewUrl ?? null,
    launchManifestPath: params.delivery.launchManifestPath ?? null,
    launchProofUrl: params.delivery.launchProofUrl ?? null,
    launchProofAt: params.delivery.launchProofAt ?? null,
    localhostReady:
      params.delivery.status === "ready" &&
      Boolean(params.delivery.launchManifestPath && params.delivery.launchProofAt),
    handoffNotes: params.delivery.handoffNotes ?? null,
    deliveredAt: params.delivery.deliveredAt ?? null,
    verificationStatus: params.verification.overallStatus,
  };
}

export function writeDeliveryManifest(params: {
  delivery: DeliveryRecord;
  assembly: AssemblyRecord;
  verification: VerificationRunRecord;
}) {
  const assemblyDir =
    params.delivery.localOutputPath ?? resolveAssemblyDirectory(params.delivery.initiativeId);
  mkdirSync(assemblyDir, { recursive: true });

  const manifestPath = path.join(assemblyDir, "delivery-manifest.json");
  const manifest = buildDeliveryManifest(params);
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  return {
    manifestPath,
    manifest,
  };
}
