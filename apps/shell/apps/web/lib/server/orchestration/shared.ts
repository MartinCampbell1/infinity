import type {
  ControlPlaneOrchestrationDirectoryMeta,
  ProjectBriefClarificationEntry,
} from "../control-plane/contracts/orchestration";
import { CONTROL_PLANE_DIRECTORY_AT } from "../control-plane/state/seeds";
import {
  buildControlPlaneStateNotes,
  getControlPlaneIntegrationState,
  getControlPlaneStorageKind,
  getControlPlaneStorageSource,
  readControlPlaneState,
} from "../control-plane/state/store";

const DEFAULT_MUTATION_AT = "2026-04-18T00:00:00.000Z";

export function nowIso() {
  const value = new Date();
  return Number.isNaN(value.getTime()) ? DEFAULT_MUTATION_AT : value.toISOString();
}

export function buildOrchestrationId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function trimRequiredString(value: string) {
  return value.trim();
}

export function trimOptionalString(value?: string | null) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeStringList(values: readonly string[] | undefined) {
  return (values ?? [])
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

export function normalizeClarificationLog(
  values: readonly ProjectBriefClarificationEntry[] | undefined
) {
  return (values ?? [])
    .map((entry) => ({
      question: entry.question.trim(),
      answer: entry.answer.trim(),
    }))
    .filter((entry) => entry.question.length > 0 && entry.answer.length > 0);
}

export function sortByUpdatedAtDesc<T extends { updatedAt: string }>(values: readonly T[]) {
  return [...values].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function buildOrchestrationDirectoryMeta(
  extraNotes: string[] = []
): Promise<ControlPlaneOrchestrationDirectoryMeta> {
  await readControlPlaneState();

  return {
    generatedAt: CONTROL_PLANE_DIRECTORY_AT,
    source: getControlPlaneStorageSource(),
    storageKind: getControlPlaneStorageKind(),
    integrationState: getControlPlaneIntegrationState(),
    canonicalTruth: "sessionId",
    notes: buildControlPlaneStateNotes(extraNotes),
  };
}
