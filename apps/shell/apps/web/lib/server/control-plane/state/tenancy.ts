import type { ControlPlaneMutationActor } from "../../http/control-plane-auth";
import { CONTROL_PLANE_TENANT_ID_ENV_KEY } from "../../http/control-plane-auth";
import type { TenantScopedRecordFields } from "../contracts/tenancy";
import { requiresFullDeploymentEnv } from "../workspace/rollout-config";
import type { ControlPlaneState } from "./types";

export const TENANT_ISOLATION_ENV_KEY = "FOUNDEROS_ENABLE_TENANT_ISOLATION";
export const TENANT_METADATA_KEY = "__founderosTenant";

type TenantTagged = {
  tenantId?: unknown;
  createdBy?: unknown;
  updatedBy?: unknown;
  raw?: unknown;
  payload?: unknown;
  actorContext?: unknown;
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function tenantFromRaw(raw: unknown) {
  const rawObject = objectValue(raw);
  if (!rawObject) {
    return null;
  }

  const direct = normalizeString(rawObject.tenantId);
  if (direct) {
    return direct;
  }

  const metadata = objectValue(rawObject[TENANT_METADATA_KEY]);
  return normalizeString(metadata?.tenantId);
}

function tenantFromActorContext(value: unknown) {
  const actorContext = objectValue(value);
  return normalizeString(actorContext?.tenantId);
}

function tenantFromPayload(payload: unknown) {
  const payloadObject = objectValue(payload);
  if (!payloadObject) {
    return null;
  }
  return tenantFromActorContext(payloadObject.actorContext);
}

export function controlPlaneTenantIsolationEnabled(
  env: Record<string, string | undefined> = process.env,
) {
  const explicit = env[TENANT_ISOLATION_ENV_KEY]?.trim();
  if (explicit !== undefined) {
    return explicit === "1";
  }
  return requiresFullDeploymentEnv(env);
}

export function activeControlPlaneTenantId(
  env: Record<string, string | undefined> = process.env,
) {
  return env[CONTROL_PLANE_TENANT_ID_ENV_KEY]?.trim() || "default";
}

export function tenantIdForRecord(record: TenantTagged) {
  return (
    normalizeString(record.tenantId) ??
    tenantFromRaw(record.raw) ??
    tenantFromPayload(record.payload) ??
    tenantFromActorContext(record.actorContext) ??
    "default"
  );
}

export function actorTenantMetadata(actor: ControlPlaneMutationActor | null | undefined) {
  if (!actor) {
    return null;
  }

  return {
    tenantId: actor.tenantId,
    createdBy: actor.actorId,
    updatedBy: actor.actorId,
    requestId: actor.requestId,
    authBoundary: actor.authBoundary,
  };
}

export function tenantScopedRecordFields(
  actor: ControlPlaneMutationActor | null | undefined,
): TenantScopedRecordFields {
  const metadata = actorTenantMetadata(actor);
  if (!metadata) {
    return {};
  }

  return {
    tenantId: metadata.tenantId,
    createdBy: metadata.createdBy,
    updatedBy: metadata.updatedBy,
  };
}

export function tenantScopedUpdateFields(
  actor: ControlPlaneMutationActor | null | undefined,
): TenantScopedRecordFields {
  const metadata = actorTenantMetadata(actor);
  if (!metadata) {
    return {};
  }

  return {
    tenantId: metadata.tenantId,
    updatedBy: metadata.updatedBy,
  };
}

export function withTenantMetadataRaw(
  raw: Record<string, unknown> | null | undefined,
  actor: ControlPlaneMutationActor | null | undefined,
) {
  const metadata = actorTenantMetadata(actor);
  if (!metadata) {
    return raw ?? null;
  }

  return {
    ...(raw ?? {}),
    [TENANT_METADATA_KEY]: metadata,
  };
}

function filterByTenant<T>(records: T[], tenantId: string) {
  return records.filter(
    (record) => tenantIdForRecord(record as TenantTagged) === tenantId,
  );
}

export function applyTenantIsolationToState(
  state: ControlPlaneState,
  tenantId: string = activeControlPlaneTenantId(),
) {
  const scoped = clone(state);
  scoped.tenancy.tenants = scoped.tenancy.tenants.filter(
    (tenant) => tenant.id === tenantId,
  );
  scoped.tenancy.users = scoped.tenancy.users.filter((user) =>
    scoped.tenancy.memberships.some(
      (membership) =>
        membership.tenantId === tenantId && membership.userId === user.id,
    ),
  );
  scoped.tenancy.memberships = scoped.tenancy.memberships.filter(
    (membership) => membership.tenantId === tenantId,
  );
  scoped.tenancy.projects = scoped.tenancy.projects.filter(
    (project) => project.tenantId === tenantId,
  );
  scoped.tenancy.workspaces = scoped.tenancy.workspaces.filter(
    (workspace) => workspace.tenantId === tenantId,
  );
  scoped.approvals.requests = filterByTenant(scoped.approvals.requests, tenantId);
  scoped.approvals.operatorActions = filterByTenant(
    scoped.approvals.operatorActions,
    tenantId,
  );
  scoped.recoveries.incidents = filterByTenant(
    scoped.recoveries.incidents,
    tenantId,
  );
  scoped.recoveries.operatorActions = filterByTenant(
    scoped.recoveries.operatorActions,
    tenantId,
  );
  scoped.accounts.snapshots = filterByTenant(scoped.accounts.snapshots, tenantId);
  scoped.accounts.updates = filterByTenant(scoped.accounts.updates, tenantId);
  scoped.sessions.events = filterByTenant(scoped.sessions.events, tenantId);
  scoped.orchestration.initiatives = filterByTenant(
    scoped.orchestration.initiatives,
    tenantId,
  );
  scoped.orchestration.briefs = filterByTenant(scoped.orchestration.briefs, tenantId);
  scoped.orchestration.taskGraphs = filterByTenant(
    scoped.orchestration.taskGraphs,
    tenantId,
  );
  scoped.orchestration.workUnits = filterByTenant(
    scoped.orchestration.workUnits,
    tenantId,
  );
  scoped.orchestration.batches = filterByTenant(scoped.orchestration.batches, tenantId);
  scoped.orchestration.supervisorActions = filterByTenant(
    scoped.orchestration.supervisorActions,
    tenantId,
  );
  scoped.orchestration.assemblies = filterByTenant(
    scoped.orchestration.assemblies,
    tenantId,
  );
  scoped.orchestration.verifications = filterByTenant(
    scoped.orchestration.verifications,
    tenantId,
  );
  scoped.orchestration.deliveries = filterByTenant(
    scoped.orchestration.deliveries,
    tenantId,
  );
  scoped.orchestration.runs = filterByTenant(scoped.orchestration.runs, tenantId);
  scoped.orchestration.specDocs = filterByTenant(
    scoped.orchestration.specDocs,
    tenantId,
  );
  scoped.orchestration.agentSessions = filterByTenant(
    scoped.orchestration.agentSessions,
    tenantId,
  );
  scoped.orchestration.refusals = filterByTenant(
    scoped.orchestration.refusals,
    tenantId,
  );
  scoped.orchestration.runEvents = filterByTenant(
    scoped.orchestration.runEvents,
    tenantId,
  );
  scoped.orchestration.previewTargets = filterByTenant(
    scoped.orchestration.previewTargets,
    tenantId,
  );
  scoped.orchestration.handoffPackets = filterByTenant(
    scoped.orchestration.handoffPackets,
    tenantId,
  );
  scoped.orchestration.validationProofs = filterByTenant(
    scoped.orchestration.validationProofs,
    tenantId,
  );
  scoped.orchestration.secretPauses = filterByTenant(
    scoped.orchestration.secretPauses,
    tenantId,
  );
  scoped.mutations.events = filterByTenant(scoped.mutations.events, tenantId);
  scoped.mutations.idempotency = filterByTenant(
    scoped.mutations.idempotency,
    tenantId,
  );

  return scoped;
}
