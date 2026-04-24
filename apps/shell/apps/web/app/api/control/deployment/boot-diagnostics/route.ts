import { NextResponse } from "next/server";

import { buildDeploymentEnvDiagnostics } from "../../../../../lib/server/control-plane/workspace/rollout-config";
import { resolveControlPlaneStoragePolicy } from "../../../../../lib/server/control-plane/state/store";
import {
  CONTROL_PLANE_SCHEMA_MIGRATIONS_TABLE,
  CONTROL_PLANE_SCHEMA_VERSION,
} from "../../../../../lib/server/control-plane/state/schema";
import {
  readControlPlaneSchemaStatusFromPostgres,
  resolveControlPlaneDatabaseUrl,
} from "../../../../../lib/server/control-plane/state/postgres";

export const dynamic = "force-dynamic";

export async function GET() {
  const diagnostics = buildDeploymentEnvDiagnostics();
  const storagePolicy = resolveControlPlaneStoragePolicy();
  const databaseUrl = resolveControlPlaneDatabaseUrl();
  const schemaStatus = databaseUrl
    ? await readControlPlaneSchemaStatusFromPostgres(databaseUrl)
        .then((status) => ({
          checked: true,
          error: null,
          ...status,
        }))
        .catch((error) => ({
          checked: true,
          expectedVersion: CONTROL_PLANE_SCHEMA_VERSION,
          observedVersion: null,
          observedName: null,
          observedChecksum: null,
          checksumMatches: false,
          ready: false,
          error:
            error instanceof Error
              ? error.message
              : "Control-plane schema status could not be read.",
        }))
    : {
        checked: false,
        expectedVersion: CONTROL_PLANE_SCHEMA_VERSION,
        observedVersion: null,
        observedName: null,
        observedChecksum: null,
        checksumMatches: false,
        ready: !storagePolicy.postgresRequired,
        error: storagePolicy.postgresRequired
          ? "Postgres URL is required before schema status can be checked."
          : null,
      };
  const schemaReady = !storagePolicy.postgresRequired || schemaStatus.ready;
  const ready = diagnostics.ready && schemaReady;
  return NextResponse.json({
    ...diagnostics,
    ready,
    storagePolicy,
    controlPlaneSchema: {
      expectedVersion: CONTROL_PLANE_SCHEMA_VERSION,
      migrationsTable: CONTROL_PLANE_SCHEMA_MIGRATIONS_TABLE,
      observed: schemaStatus,
    },
    readOnly: storagePolicy.postgresRequired && !ready,
    degraded: storagePolicy.postgresRequired && !ready,
  });
}
