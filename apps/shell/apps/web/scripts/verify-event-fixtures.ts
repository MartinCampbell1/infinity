import { readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";
import {
  materializeGroupProjections,
  materializeSessionProjections,
  normalizeCodexJsonlEvents,
  normalizeHermesSseEvents,
  normalizeSupervisorNdjsonEvents,
  sortNormalizedEvents,
  validateGroupProjectionState,
  validateNormalizedExecutionEvents,
  validateSessionProjectionState,
} from "../lib/server/control-plane/events/index.ts";

type JsonRecord = Record<string, unknown>;

interface GoldenNormalizationInput {
  normalizer:
    | "normalizeCodexJsonlEvents"
    | "normalizeHermesSseEvents"
    | "normalizeSupervisorNdjsonEvents";
  sessionId: string | null;
  projectId: string;
  groupId: string | null;
}

interface GoldenNormalizedFixture {
  normalizationInput: GoldenNormalizationInput;
  events: JsonRecord[];
}

interface GoldenProjectionFixture {
  sessionId: string;
  expectedSummary: JsonRecord;
  expectedGroupProjection: JsonRecord;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(__dirname, "..");
const infinityRoot = resolve(appRoot, "../../../..");
const fixturesRoot = join(infinityRoot, "fixtures");
const goldenNormalizedDir = join(fixturesRoot, "golden", "normalized-events");
const goldenProjectionDir = join(fixturesRoot, "golden", "session-projections");
const rawRoot = join(fixturesRoot, "raw");

function readJsonFile(path: string) {
  return JSON.parse(readFileSync(path, "utf8")) as JsonRecord;
}

function sortByName(files: string[]) {
  return files.sort((left, right) => left.localeCompare(right));
}

function listFixtureFiles(directory: string, suffix: string) {
  return sortByName(
    readdirSync(directory)
      .filter((name) => name.endsWith(suffix))
      .map((name) => join(directory, name))
  );
}

function compareSubset(
  actual: JsonRecord,
  expected: JsonRecord,
  context: string
): string[] {
  const errors: string[] = [];
  for (const key of Object.keys(expected)) {
    const expectedValue = expected[key];
    const actualValue = actual[key];
    if (!isEqual(actualValue, expectedValue)) {
      errors.push(
        `${context}.${key} expected=${safeString(expectedValue)} actual=${safeString(actualValue)}`
      );
    }
  }
  return errors;
}

function isEqual(left: unknown, right: unknown): boolean {
  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) {
      return false;
    }
    for (let index = 0; index < left.length; index += 1) {
      if (!isEqual(left[index], right[index])) {
        return false;
      }
    }
    return true;
  }

  if (left && right && typeof left === "object" && typeof right === "object") {
    const leftRecord = left as JsonRecord;
    const rightRecord = right as JsonRecord;
    const leftKeys = Object.keys(leftRecord);
    const rightKeys = Object.keys(rightRecord);
    if (leftKeys.length !== rightKeys.length) {
      return false;
    }
    for (const key of leftKeys) {
      if (!isEqual(leftRecord[key], rightRecord[key])) {
        return false;
      }
    }
    return true;
  }

  return left === right;
}

function safeString(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function normalizeFromRaw(input: GoldenNormalizationInput, rawPath: string) {
  if (input.normalizer === "normalizeCodexJsonlEvents") {
    const lines = readFileSync(rawPath, "utf8")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    return normalizeCodexJsonlEvents({
      lines,
      sessionId: input.sessionId ?? "unknown_session",
      projectId: input.projectId,
      groupId: input.groupId,
    });
  }

  if (input.normalizer === "normalizeHermesSseEvents") {
    const stream = readFileSync(rawPath, "utf8");
    return normalizeHermesSseEvents({
      stream,
      sessionId: input.sessionId ?? "unknown_session",
      projectId: input.projectId,
      groupId: input.groupId,
    });
  }

  const lines = readFileSync(rawPath, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return normalizeSupervisorNdjsonEvents({
    lines,
    sessionId: input.sessionId ?? undefined,
    projectId: input.projectId,
    groupId: input.groupId,
  });
}

function resolveRawFixturePath(
  goldenFile: string,
  input: GoldenNormalizationInput
) {
  const rawBase = basename(goldenFile, ".normalized.json");
  if (input.normalizer === "normalizeCodexJsonlEvents") {
    return join(rawRoot, "codex-jsonl", `${rawBase}.jsonl`);
  }
  if (input.normalizer === "normalizeHermesSseEvents") {
    return join(rawRoot, "hermes-sse", `${rawBase}.sse`);
  }
  return join(rawRoot, "codext-session-supervisor", `${rawBase}.ndjson`);
}

function resolveProjectionFixturePath(goldenFile: string) {
  const rawBase = basename(goldenFile, ".normalized.json");
  return join(goldenProjectionDir, `${rawBase}.projection.json`);
}

function verifyFixture(goldenFilePath: string): string[] {
  const fixture = readJsonFile(goldenFilePath) as GoldenNormalizedFixture;
  const rawFixturePath = resolveRawFixturePath(
    goldenFilePath,
    fixture.normalizationInput
  );
  const normalizedEvents = normalizeFromRaw(
    fixture.normalizationInput,
    rawFixturePath
  );

  const errors: string[] = [];
  errors.push(...validateNormalizedExecutionEvents(normalizedEvents));

  if (normalizedEvents.length !== fixture.events.length) {
    errors.push(
      `${basename(goldenFilePath)} events.length expected=${fixture.events.length} actual=${normalizedEvents.length}`
    );
  }

  const sortedEvents = sortNormalizedEvents(normalizedEvents);
  if (!isEqual(sortedEvents, normalizedEvents)) {
    errors.push(
      `${basename(goldenFilePath)} normalized event order is not canonical`
    );
  }

  const comparableCount = Math.min(normalizedEvents.length, fixture.events.length);
  for (let index = 0; index < comparableCount; index += 1) {
    const expected = fixture.events[index] ?? {};
    const actual = normalizedEvents[index] as unknown as JsonRecord;
    errors.push(
      ...compareSubset(actual, expected, `${basename(goldenFilePath)}.events[${index}]`)
    );
  }

  const projectionFixturePath = resolveProjectionFixturePath(goldenFilePath);
  const projection = readJsonFile(projectionFixturePath) as GoldenProjectionFixture;
  const sessions = materializeSessionProjections(normalizedEvents);
  const groups = materializeGroupProjections(normalizedEvents);
  const session = sessions[projection.sessionId];

  if (!session) {
    errors.push(
      `${basename(goldenFilePath)} missing session projection for ${projection.sessionId}`
    );
  } else {
    errors.push(...validateSessionProjectionState(session));
    errors.push(
      ...compareSubset(
        session as unknown as JsonRecord,
        projection.expectedSummary,
        `${basename(projectionFixturePath)}.expectedSummary`
      )
    );
  }

  const groupId =
    (projection.expectedGroupProjection.id as string | undefined) ?? "ungrouped";
  const group = groups[groupId];
  if (!group) {
    errors.push(
      `${basename(goldenFilePath)} missing group projection for ${groupId}`
    );
  } else {
    errors.push(...validateGroupProjectionState(group));
    errors.push(
      ...compareSubset(
        group as unknown as JsonRecord,
        projection.expectedGroupProjection,
        `${basename(projectionFixturePath)}.expectedGroupProjection`
      )
    );
  }

  return errors;
}

function main() {
  const goldenFiles = listFixtureFiles(goldenNormalizedDir, ".normalized.json");
  if (goldenFiles.length === 0) {
    console.error("No normalized golden fixtures found.");
    process.exit(1);
  }

  const failures: string[] = [];
  for (const file of goldenFiles) {
    failures.push(...verifyFixture(file));
  }

  if (failures.length > 0) {
    console.error("Fixture verification failed:");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log(
    `Fixture verification passed for ${goldenFiles.length} normalized scenarios.`
  );
}

main();
