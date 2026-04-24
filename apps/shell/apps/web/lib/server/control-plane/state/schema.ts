export const CONTROL_PLANE_SCHEMA_MIGRATIONS_TABLE =
  "shell_control_plane_schema_migrations";
export const CONTROL_PLANE_SCHEMA_VERSION = 3;
export const CONTROL_PLANE_SCHEMA_NAME = "mutation_journal_idempotency";
export const CONTROL_PLANE_SCHEMA_CHECKSUM =
  "be1f1a99787cc7cabee0ede64ad2e20bc5ac13103eff98e29d1f4f0c2e779192";

export type Queryable = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
};

export interface ControlPlaneSchemaStatus {
  expectedVersion: number;
  observedVersion: number | null;
  observedName: string | null;
  observedChecksum: string | null;
  checksumMatches: boolean;
  ready: boolean;
}

export class ControlPlaneSchemaMismatchError extends Error {
  readonly code = "control_plane_schema_mismatch";
  readonly expectedVersion = CONTROL_PLANE_SCHEMA_VERSION;
  readonly observedVersion: number | null;
  readonly observedName: string | null;
  readonly observedChecksum: string | null;

  constructor(
    message: string,
    status: Omit<
      ControlPlaneSchemaStatus,
      "ready" | "expectedVersion" | "checksumMatches"
    >,
  ) {
    super(message);
    this.name = "ControlPlaneSchemaMismatchError";
    this.observedVersion = status.observedVersion;
    this.observedName = status.observedName;
    this.observedChecksum = status.observedChecksum;
  }
}

function asSchemaRow(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const row = value as {
    version?: unknown;
    name?: unknown;
    checksum?: unknown;
  };
  const version =
    typeof row.version === "number"
      ? row.version
      : typeof row.version === "string"
        ? Number.parseInt(row.version, 10)
        : Number.NaN;

  if (!Number.isFinite(version)) {
    return null;
  }

  return {
    version,
    name: typeof row.name === "string" ? row.name : null,
    checksum: typeof row.checksum === "string" ? row.checksum : null,
  };
}

function isUndefinedTableError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "42P01"
  );
}

export async function readControlPlaneSchemaStatus(
  queryable: Queryable,
): Promise<ControlPlaneSchemaStatus> {
  try {
    const result = await queryable.query(`
      SELECT version, name, checksum
      FROM ${CONTROL_PLANE_SCHEMA_MIGRATIONS_TABLE}
      ORDER BY version DESC
      LIMIT 1
    `);
    const latest = asSchemaRow(result.rows[0]);

    return {
      expectedVersion: CONTROL_PLANE_SCHEMA_VERSION,
      observedVersion: latest?.version ?? null,
      observedName: latest?.name ?? null,
      observedChecksum: latest?.checksum ?? null,
      checksumMatches: latest?.checksum === CONTROL_PLANE_SCHEMA_CHECKSUM,
      ready:
        latest?.version === CONTROL_PLANE_SCHEMA_VERSION &&
        latest?.checksum === CONTROL_PLANE_SCHEMA_CHECKSUM,
    };
  } catch (error) {
    if (isUndefinedTableError(error)) {
      return {
        expectedVersion: CONTROL_PLANE_SCHEMA_VERSION,
        observedVersion: null,
        observedName: null,
        observedChecksum: null,
        checksumMatches: false,
        ready: false,
      };
    }
    throw error;
  }
}

export async function assertControlPlaneSchemaReady(queryable: Queryable) {
  const status = await readControlPlaneSchemaStatus(queryable);
  if (status.ready) {
    return status;
  }

  throw new ControlPlaneSchemaMismatchError(
    status.observedVersion === null
      ? `Control-plane Postgres schema is not migrated. Apply migrations until version ${CONTROL_PLANE_SCHEMA_VERSION} before starting production runtime.`
      : !status.checksumMatches
        ? `Control-plane Postgres schema version ${status.observedVersion} has checksum ${status.observedChecksum ?? "missing"}, expected ${CONTROL_PLANE_SCHEMA_CHECKSUM}. Re-run migration status and resolve schema drift before starting production runtime.`
      : `Control-plane Postgres schema version ${status.observedVersion} does not match expected version ${CONTROL_PLANE_SCHEMA_VERSION}. Apply or roll back migrations before starting production runtime.`,
    {
      observedVersion: status.observedVersion,
      observedName: status.observedName,
      observedChecksum: status.observedChecksum,
    },
  );
}
