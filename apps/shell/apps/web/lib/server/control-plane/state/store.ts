import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type {
  ControlPlaneDirectoryMeta,
  ControlPlaneIntegrationState,
  ControlPlaneStorageKind,
} from "../contracts/control-plane-meta";
import {
  ACCOUNT_QUOTA_SNAPSHOT_SEEDS,
  ACCOUNT_QUOTA_UPDATE_SEEDS,
  APPROVAL_REQUEST_SEEDS,
  CONTROL_PLANE_DIRECTORY_AT,
  NORMALIZED_EVENT_SEEDS,
  RECOVERY_INCIDENT_SEEDS,
} from "./seeds";
import {
  assertDeploymentEnvReady,
  requiresFullDeploymentEnv,
  resolveFounderOsDeploymentEnv,
} from "../workspace/rollout-config";
import {
  type ControlPlaneRelationalDelta,
  describeControlPlaneDatabaseTarget,
  readControlPlaneStateFromPostgres,
  resolveControlPlaneDatabaseUrl,
  resetControlPlanePostgresPoolForTests,
  updateControlPlaneStateInPostgres,
  writeControlPlaneStateToPostgres,
} from "./postgres";
import type {
  ControlPlaneState,
  StoredAccountsState,
  StoredApprovalsState,
  StoredOrchestrationState,
  StoredRecoveriesState,
  StoredSessionsState,
  StoredMutationsState,
  StoredTenancyState,
} from "./types";
import {
  activeControlPlaneTenantId,
  applyTenantIsolationToState,
  controlPlaneTenantIsolationEnabled,
} from "./tenancy";

const CONTROL_PLANE_STATE_FILE = "control-plane.state.json";
const LEGACY_APPROVALS_STATE_FILE = "approvals.state.json";
const LEGACY_RECOVERIES_STATE_FILE = "recoveries.state.json";
export const CONTROL_PLANE_STORAGE_MODE_ENV_KEY =
  "FOUNDEROS_CONTROL_PLANE_STORAGE_MODE";
export type ControlPlaneStorageMode = "normal" | "migration_recovery";

export interface ControlPlaneStoragePolicy {
  deploymentEnv: ReturnType<typeof resolveFounderOsDeploymentEnv>;
  mode: ControlPlaneStorageMode;
  localFileAllowed: boolean;
  fileStateImportAllowed: boolean;
  postgresRequired: boolean;
  degradedMode: "local_file_fallback" | "read_only";
}

export class ControlPlaneStorageUnavailableError extends Error {
  readonly code = "control_plane_storage_unavailable";
  readonly status = 503;
  readonly storagePolicy: ControlPlaneStoragePolicy;

  constructor(message: string, storagePolicy: ControlPlaneStoragePolicy) {
    super(message);
    this.name = "ControlPlaneStorageUnavailableError";
    this.storagePolicy = storagePolicy;
  }
}

let cachedState: ControlPlaneState | null = null;
let hydrated = false;
let hydrationPromise: Promise<void> | null = null;
let mutationQueue: Promise<void> = Promise.resolve();
let integrationState: ControlPlaneIntegrationState = "unknown";
let lastPersistenceError: string | null = null;
let storageKind: ControlPlaneStorageKind = "unknown";
let storageSource: ControlPlaneDirectoryMeta["source"] = "derived";
let storageDescriptor = "";

const STATE_STORE_DIR = path.dirname(fileURLToPath(import.meta.url));

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function syntheticStateSeedsEnabled() {
  const explicit = process.env.FOUNDEROS_ENABLE_SYNTHETIC_STATE_SEEDS;
  if (explicit !== undefined) {
    return explicit === "1";
  }

  return process.env.NODE_ENV === "test";
}

export function resolveControlPlaneStoragePolicy(
  env: Record<string, string | undefined> = process.env,
): ControlPlaneStoragePolicy {
  const deploymentEnv = resolveFounderOsDeploymentEnv(env);
  const mode =
    env[CONTROL_PLANE_STORAGE_MODE_ENV_KEY]?.trim() === "migration_recovery"
      ? "migration_recovery"
      : "normal";
  const productionLike = requiresFullDeploymentEnv(env);
  const localFileAllowed = !productionLike || mode === "migration_recovery";
  const postgresRequired = productionLike && mode !== "migration_recovery";
  return {
    deploymentEnv,
    mode,
    localFileAllowed,
    fileStateImportAllowed: localFileAllowed,
    postgresRequired,
    degradedMode: localFileAllowed ? "local_file_fallback" : "read_only",
  };
}

export function isControlPlaneStorageUnavailableError(
  error: unknown,
): error is ControlPlaneStorageUnavailableError {
  return error instanceof ControlPlaneStorageUnavailableError;
}

export function buildControlPlaneStorageUnavailableProblem(
  error: ControlPlaneStorageUnavailableError,
) {
  return {
    code: error.code,
    detail: error.message,
    storagePolicy: error.storagePolicy,
    storageKind: "unknown" as ControlPlaneStorageKind,
    integrationState: "degraded" as ControlPlaneIntegrationState,
    degraded: true,
    readOnly: true,
  };
}

function stateDirPath() {
  return (
    process.env.FOUNDEROS_CONTROL_PLANE_STATE_DIR ??
    path.join(
      path.resolve(STATE_STORE_DIR, "../../../../../../.."),
      ".control-plane-state",
    )
  );
}

export function getControlPlaneStatePath() {
  return path.join(stateDirPath(), CONTROL_PLANE_STATE_FILE);
}

function legacyApprovalsStatePath() {
  return path.join(stateDirPath(), LEGACY_APPROVALS_STATE_FILE);
}

function legacyRecoveriesStatePath() {
  return path.join(stateDirPath(), LEGACY_RECOVERIES_STATE_FILE);
}

function defaultState(): ControlPlaneState {
  const useSyntheticSeeds = syntheticStateSeedsEnabled();
  return {
    version: 1,
    seededAt: CONTROL_PLANE_DIRECTORY_AT,
    approvals: {
      requests: useSyntheticSeeds ? clone(APPROVAL_REQUEST_SEEDS) : [],
      operatorActions: [],
      actionSequence: 1,
    },
    recoveries: {
      incidents: useSyntheticSeeds ? clone(RECOVERY_INCIDENT_SEEDS) : [],
      operatorActions: [],
      actionSequence: 101,
    },
    accounts: {
      snapshots: useSyntheticSeeds ? clone(ACCOUNT_QUOTA_SNAPSHOT_SEEDS) : [],
      updates: useSyntheticSeeds ? clone(ACCOUNT_QUOTA_UPDATE_SEEDS) : [],
    },
    sessions: {
      events: useSyntheticSeeds ? clone(NORMALIZED_EVENT_SEEDS) : [],
    },
    tenancy: {
      tenants: [
        {
          id: activeControlPlaneTenantId(),
          name: "Default Infinity tenant",
          status: "active",
          createdAt: CONTROL_PLANE_DIRECTORY_AT,
          updatedAt: CONTROL_PLANE_DIRECTORY_AT,
        },
      ],
      users: [
        {
          id: "infinity-operator",
          email: "operator@infinity.local",
          displayName: "Infinity Operator",
          status: "active",
          createdAt: CONTROL_PLANE_DIRECTORY_AT,
          updatedAt: CONTROL_PLANE_DIRECTORY_AT,
        },
      ],
      memberships: [
        {
          id: `${activeControlPlaneTenantId()}:infinity-operator`,
          tenantId: activeControlPlaneTenantId(),
          userId: "infinity-operator",
          role: "owner",
          status: "active",
          createdAt: CONTROL_PLANE_DIRECTORY_AT,
          updatedAt: CONTROL_PLANE_DIRECTORY_AT,
        },
      ],
      projects: [],
      workspaces: [],
    },
    orchestration: {
      initiatives: [],
      briefs: [],
      taskGraphs: [],
      workUnits: [],
      batches: [],
      supervisorActions: [],
      assemblies: [],
      verifications: [],
      deliveries: [],
      runs: [],
      specDocs: [],
      agentSessions: [],
      refusals: [],
      runEvents: [],
      previewTargets: [],
      handoffPackets: [],
      validationProofs: [],
      secretPauses: [],
    },
    mutations: {
      events: [],
      idempotency: [],
    },
  };
}

function parseApprovalState(value: unknown): StoredApprovalsState | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<StoredApprovalsState>;
  if (
    !Array.isArray(candidate.requests) ||
    !Array.isArray(candidate.operatorActions)
  ) {
    return null;
  }

  const actionSequence =
    typeof candidate.actionSequence === "number" &&
    Number.isFinite(candidate.actionSequence)
      ? Math.max(1, Math.floor(candidate.actionSequence))
      : 1;

  return {
    requests: clone(candidate.requests),
    operatorActions: clone(candidate.operatorActions),
    actionSequence,
  };
}

function parseRecoveryState(value: unknown): StoredRecoveriesState | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<StoredRecoveriesState>;
  if (
    !Array.isArray(candidate.incidents) ||
    !Array.isArray(candidate.operatorActions)
  ) {
    return null;
  }

  const actionSequence =
    typeof candidate.actionSequence === "number" &&
    Number.isFinite(candidate.actionSequence)
      ? Math.max(101, Math.floor(candidate.actionSequence))
      : 101;

  return {
    incidents: clone(candidate.incidents),
    operatorActions: clone(candidate.operatorActions),
    actionSequence,
  };
}

function parseAccountsState(value: unknown): StoredAccountsState | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<StoredAccountsState>;
  if (
    !Array.isArray(candidate.snapshots) ||
    !Array.isArray(candidate.updates)
  ) {
    return null;
  }

  return {
    snapshots: clone(candidate.snapshots),
    updates: clone(candidate.updates),
  };
}

function parseSessionsState(value: unknown): StoredSessionsState | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<StoredSessionsState>;
  if (!Array.isArray(candidate.events)) {
    return null;
  }

  return {
    events: clone(candidate.events),
  };
}

function parseTenancyState(value: unknown): StoredTenancyState {
  if (!value || typeof value !== "object") {
    return defaultState().tenancy;
  }

  const candidate = value as Partial<StoredTenancyState>;
  return {
    tenants: clone(Array.isArray(candidate.tenants) ? candidate.tenants : []),
    users: clone(Array.isArray(candidate.users) ? candidate.users : []),
    memberships: clone(
      Array.isArray(candidate.memberships) ? candidate.memberships : [],
    ),
    projects: clone(Array.isArray(candidate.projects) ? candidate.projects : []),
    workspaces: clone(
      Array.isArray(candidate.workspaces) ? candidate.workspaces : [],
    ),
  };
}

function parseOrchestrationState(
  value: unknown,
): StoredOrchestrationState | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<StoredOrchestrationState>;
  if (
    !Array.isArray(candidate.initiatives) ||
    !Array.isArray(candidate.briefs) ||
    !Array.isArray(candidate.taskGraphs) ||
    !Array.isArray(candidate.workUnits) ||
    !Array.isArray(candidate.batches) ||
    !Array.isArray(candidate.supervisorActions) ||
    !Array.isArray(candidate.assemblies) ||
    !Array.isArray(candidate.verifications) ||
    !Array.isArray(candidate.deliveries)
  ) {
    return null;
  }

  return {
    initiatives: clone(candidate.initiatives),
    briefs: clone(candidate.briefs),
    taskGraphs: clone(candidate.taskGraphs),
    workUnits: clone(candidate.workUnits),
    batches: clone(candidate.batches),
    supervisorActions: clone(candidate.supervisorActions),
    assemblies: clone(candidate.assemblies),
    verifications: clone(candidate.verifications),
    deliveries: clone(candidate.deliveries),
    runs: clone(Array.isArray(candidate.runs) ? candidate.runs : []),
    specDocs: clone(
      Array.isArray(candidate.specDocs) ? candidate.specDocs : [],
    ),
    agentSessions: clone(
      Array.isArray(candidate.agentSessions) ? candidate.agentSessions : [],
    ),
    refusals: clone(
      Array.isArray(candidate.refusals) ? candidate.refusals : [],
    ),
    runEvents: clone(
      Array.isArray(candidate.runEvents) ? candidate.runEvents : [],
    ),
    previewTargets: clone(
      Array.isArray(candidate.previewTargets) ? candidate.previewTargets : [],
    ),
    handoffPackets: clone(
      Array.isArray(candidate.handoffPackets) ? candidate.handoffPackets : [],
    ),
    validationProofs: clone(
      Array.isArray(candidate.validationProofs)
        ? candidate.validationProofs
        : [],
    ),
    secretPauses: clone(
      Array.isArray(candidate.secretPauses) ? candidate.secretPauses : [],
    ),
  };
}

function parseMutationsState(value: unknown): StoredMutationsState {
  if (!value || typeof value !== "object") {
    return defaultState().mutations;
  }

  const candidate = value as Partial<StoredMutationsState>;
  return {
    events: clone(Array.isArray(candidate.events) ? candidate.events : []),
    idempotency: clone(
      Array.isArray(candidate.idempotency) ? candidate.idempotency : [],
    ),
  };
}

function parseState(raw: string): ControlPlaneState | null {
  try {
    const candidate = JSON.parse(raw) as Partial<ControlPlaneState>;
    const approvals = parseApprovalState(candidate.approvals);
    const recoveries = parseRecoveryState(candidate.recoveries);
    const accounts = parseAccountsState(candidate.accounts);
    const sessions = parseSessionsState(candidate.sessions);
    const tenancy = parseTenancyState(candidate.tenancy);
    const orchestration = parseOrchestrationState(candidate.orchestration);
    const mutations = parseMutationsState(candidate.mutations);

    if (!approvals || !recoveries || !accounts || !sessions || !orchestration) {
      return null;
    }

    return {
      version: 1,
      seededAt:
        typeof candidate.seededAt === "string" && candidate.seededAt.trim()
          ? candidate.seededAt
          : CONTROL_PLANE_DIRECTORY_AT,
      approvals,
      recoveries,
      accounts,
      sessions,
      tenancy,
      orchestration,
      mutations,
    };
  } catch {
    return null;
  }
}

function parseLegacyStoredState<T>(
  filePath: string,
  parser: (value: unknown) => T | null,
): T | null {
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const raw = readFileSync(filePath, "utf8");
    return parser(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function buildInitialControlPlaneStateForPolicy(
  policy: ControlPlaneStoragePolicy = resolveControlPlaneStoragePolicy(),
): ControlPlaneState {
  const state = defaultState();

  if (!policy.fileStateImportAllowed) {
    return state;
  }

  const unifiedFileState = readFileState();
  if (unifiedFileState) {
    return unifiedFileState;
  }

  const legacyApprovals = parseLegacyStoredState(
    legacyApprovalsStatePath(),
    parseApprovalState,
  );
  if (legacyApprovals) {
    state.approvals = legacyApprovals;
  }

  const legacyRecoveries = parseLegacyStoredState(
    legacyRecoveriesStatePath(),
    parseRecoveryState,
  );
  if (legacyRecoveries) {
    state.recoveries = legacyRecoveries;
  }

  return state;
}

function buildInitialState(): ControlPlaneState {
  return buildInitialControlPlaneStateForPolicy();
}

function readFileState() {
  const filePath = getControlPlaneStatePath();
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    return parseState(readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function persistFileState(nextState: ControlPlaneState) {
  const filePath = getControlPlaneStatePath();
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;

  try {
    mkdirSync(stateDirPath(), { recursive: true });
    writeFileSync(tempPath, JSON.stringify(nextState, null, 2), "utf8");
    renameSync(tempPath, filePath);
    return { ok: true as const, error: null };
  } catch (error) {
    try {
      unlinkSync(tempPath);
    } catch {
      // Ignore temp cleanup failures on a best-effort local persistence path.
    }

    return {
      ok: false as const,
      error:
        error instanceof Error
          ? error.message
          : "Failed to persist unified control-plane store state.",
    };
  }
}

function setResolvedStorageMeta(
  nextStorageKind: ControlPlaneStorageKind,
  nextSource: ControlPlaneDirectoryMeta["source"],
  nextIntegrationState: ControlPlaneIntegrationState,
  nextDescriptor: string,
  nextError: string | null,
) {
  storageKind = nextStorageKind;
  storageSource = nextSource;
  integrationState = nextIntegrationState;
  storageDescriptor = nextDescriptor;
  lastPersistenceError = nextError;
}

function setLocalStorageMeta(params: {
  persistenceOk: boolean;
  degraded: boolean;
  descriptor: string;
  error: string | null;
}) {
  setResolvedStorageMeta(
    params.persistenceOk ? "file_backed" : "in_memory",
    "derived",
    params.degraded ? "degraded" : "wired",
    params.descriptor,
    params.error,
  );
}

function buildPostgresRequiredStorageError(message: string) {
  const policy = resolveControlPlaneStoragePolicy();
  return new ControlPlaneStorageUnavailableError(
    `FounderOS ${policy.deploymentEnv} deployment requires Postgres-backed control-plane storage; refusing local file fallback. ${message}`,
    policy,
  );
}

function assertDeploymentEnvReadyForStorage() {
  const policy = resolveControlPlaneStoragePolicy();
  if (policy.mode === "migration_recovery") {
    return;
  }

  try {
    assertDeploymentEnvReady();
  } catch (error) {
    const databaseUrl = resolveControlPlaneDatabaseUrl();
    if (policy.postgresRequired && !databaseUrl) {
      throw buildPostgresRequiredStorageError(
        error instanceof Error
          ? error.message
          : "Postgres-backed control-plane storage is not configured.",
      );
    }
    throw error;
  }
}

async function hydrate() {
  if (hydrated && cachedState) {
    return;
  }

  if (hydrationPromise) {
    await hydrationPromise;
    return;
  }

  hydrationPromise = (async () => {
    assertDeploymentEnvReadyForStorage();
    const databaseUrl = resolveControlPlaneDatabaseUrl();
    const fileDescriptor = `State file: ${getControlPlaneStatePath()}`;

    if (databaseUrl) {
      const postgresDescriptor = `Postgres: ${describeControlPlaneDatabaseTarget(databaseUrl)}`;

      try {
        const postgresState =
          await readControlPlaneStateFromPostgres(databaseUrl);
        if (postgresState) {
          cachedState = clone(postgresState);
          setResolvedStorageMeta(
            "postgres",
            "postgres",
            "wired",
            postgresDescriptor,
            null,
          );
          return;
        }

        const seededState = buildInitialState();
        await writeControlPlaneStateToPostgres(databaseUrl, seededState);
        cachedState = clone(seededState);
        setResolvedStorageMeta(
          "postgres",
          "postgres",
          "wired",
          postgresDescriptor,
          null,
        );
        return;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Postgres-backed control-plane storage is unavailable.";
        if (!resolveControlPlaneStoragePolicy().localFileAllowed) {
          throw buildPostgresRequiredStorageError(message);
        }
        const fileState = buildInitialState();
        const persistence = persistFileState(fileState);

        cachedState = clone(fileState);
        setLocalStorageMeta({
          persistenceOk: persistence.ok,
          degraded: true,
          descriptor: fileDescriptor,
          error: persistence.ok
            ? `Postgres unavailable; fell back to unified file-backed state. ${message}`
            : `Postgres unavailable and file fallback persistence failed. ${message}; ${persistence.error}`,
        });
        return;
      }
    }

    const existingFileState = readFileState();
    if (existingFileState) {
      cachedState = clone(existingFileState);
      setLocalStorageMeta({
        persistenceOk: true,
        degraded: false,
        descriptor: fileDescriptor,
        error: null,
      });
      return;
    }

    const seededState = buildInitialState();
    const persistence = persistFileState(seededState);
    cachedState = clone(seededState);
    setLocalStorageMeta({
      persistenceOk: persistence.ok,
      degraded: !persistence.ok,
      descriptor: fileDescriptor,
      error: persistence.error,
    });
  })().finally(() => {
    hydrated = true;
    hydrationPromise = null;
  });

  await hydrationPromise;
}

export async function readControlPlaneState(): Promise<ControlPlaneState> {
  await hydrate();

  if (storageKind !== "postgres") {
    const latestFileState = readFileState();
    if (latestFileState) {
      cachedState = clone(latestFileState);
    }
  }

  const state = clone(cachedState ?? defaultState());
  return controlPlaneTenantIsolationEnabled()
    ? applyTenantIsolationToState(state)
    : state;
}

export async function getWiredControlPlaneDatabaseUrl() {
  await hydrate();
  if (storageKind !== "postgres" || controlPlaneTenantIsolationEnabled()) {
    return null;
  }
  return resolveControlPlaneDatabaseUrl();
}

export async function updateControlPlaneState(
  mutate: (draft: ControlPlaneState) => void | Promise<void>,
  options?: {
    buildRelationalDelta?: (
      state: ControlPlaneState,
    ) => ControlPlaneRelationalDelta | null | undefined;
    lockTenantId?: string | null;
    lockResourceId?: string | null;
  },
): Promise<{
  state: ControlPlaneState;
  integrationState: ControlPlaneIntegrationState;
  lastPersistenceError: string | null;
}> {
  const runMutation = async () => {
    await hydrate();
    const databaseUrl = resolveControlPlaneDatabaseUrl();

    if (databaseUrl) {
      const postgresDescriptor = `Postgres: ${describeControlPlaneDatabaseTarget(databaseUrl)}`;

      try {
        const draft = await updateControlPlaneStateInPostgres(
          databaseUrl,
          cachedState ?? defaultState(),
          mutate,
          {
            buildRelationalDelta: options?.buildRelationalDelta,
            lockTenantId: options?.lockTenantId,
            lockResourceId: options?.lockResourceId,
          },
        );
        cachedState = clone(draft);
        setResolvedStorageMeta(
          "postgres",
          "postgres",
          "wired",
          postgresDescriptor,
          null,
        );
        return {
          state: clone(draft),
          integrationState,
          lastPersistenceError,
        };
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to persist Postgres-backed control-plane state.";
        if (!resolveControlPlaneStoragePolicy().localFileAllowed) {
          throw buildPostgresRequiredStorageError(message);
        }
        const draft = clone(cachedState ?? defaultState());
        await mutate(draft);
        const persistence = persistFileState(draft);
        cachedState = clone(draft);
        setLocalStorageMeta({
          persistenceOk: persistence.ok,
          degraded: true,
          descriptor: `State file: ${getControlPlaneStatePath()}`,
          error: persistence.ok
            ? `Postgres write failed; fell back to unified file-backed state. ${message}`
            : `Postgres write failed and file fallback persistence failed. ${message}; ${persistence.error}`,
        });
        return {
          state: clone(draft),
          integrationState,
          lastPersistenceError,
        };
      }
    }

    const draft = clone(cachedState ?? defaultState());
    await mutate(draft);
    const persistence = persistFileState(draft);
    cachedState = clone(draft);
    setLocalStorageMeta({
      persistenceOk: persistence.ok,
      degraded: !persistence.ok,
      descriptor: `State file: ${getControlPlaneStatePath()}`,
      error: persistence.error,
    });

    return {
      state: clone(draft),
      integrationState,
      lastPersistenceError,
    };
  };

  const queuedMutation = mutationQueue.then(runMutation, runMutation);
  mutationQueue = queuedMutation.then(
    () => undefined,
    () => undefined,
  );
  return queuedMutation;
}

export function getControlPlaneStorageKind() {
  return storageKind;
}

export function getControlPlaneStorageSource() {
  return storageSource;
}

export function buildControlPlaneStateNotes(extraNotes: string[] = []) {
  const notes = [
    storageKind === "postgres"
      ? "Local Infinity shell copy uses a shell-owned Postgres durability boundary with relational read models."
      : storageKind === "in_memory"
        ? "Local Infinity shell copy is running on shell-owned in-memory state because file persistence is unavailable."
        : "Local Infinity shell copy uses a shell-owned local file-backed durability boundary.",
    "sessionId remains the canonical truth key across boards, workspace handoff, approvals, recoveries, and quota surfaces.",
    storageDescriptor || `State file: ${getControlPlaneStatePath()}`,
  ];

  if (lastPersistenceError) {
    notes.push(`Persistence warning: ${lastPersistenceError}`);
  } else if (storageKind === "postgres") {
    notes.push(
      "State persistence and read-facing control-plane projections are backed by Postgres for shell-owned durability.",
    );
  } else if (storageKind === "in_memory") {
    notes.push(
      "State is currently in-memory only because local file persistence is unavailable.",
    );
  } else {
    notes.push(
      "State persistence is file-backed for local shell-owned durability.",
    );
  }

  return [...notes, ...extraNotes];
}

export function getControlPlaneIntegrationState() {
  return integrationState;
}

export function resetControlPlaneStateForTests() {
  cachedState = null;
  hydrated = false;
  hydrationPromise = null;
  mutationQueue = Promise.resolve();
  setResolvedStorageMeta("unknown", "derived", "unknown", "", null);
  resetControlPlanePostgresPoolForTests();
}
