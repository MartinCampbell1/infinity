import { createHash } from "node:crypto";

import type {
  ControlPlaneIdempotencyRecord,
  ControlPlaneMutationEventRecord,
  ControlPlaneMutationResourceKind,
  ControlPlaneState,
} from "./types";
import { readControlPlaneState, updateControlPlaneState } from "./store";
import { activeControlPlaneTenantId } from "./tenancy";

export const CONTROL_PLANE_IDEMPOTENCY_HEADER = "idempotency-key";
export const CONTROL_PLANE_IDEMPOTENCY_ALT_HEADER = "x-idempotency-key";

export class ControlPlaneIdempotencyConflictError extends Error {
  readonly code = "idempotency_key_conflict";
  readonly status = 409;

  constructor(idempotencyKey: string) {
    super(
      `Idempotency key ${idempotencyKey} was already used with a different request payload.`,
    );
    this.name = "ControlPlaneIdempotencyConflictError";
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function nowIso() {
  const value = new Date();
  return Number.isNaN(value.getTime())
    ? "2026-04-24T00:00:00.000Z"
    : value.toISOString();
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

export function controlPlaneIdempotencyKeyFromRequest(request: Request) {
  return (
    request.headers.get(CONTROL_PLANE_IDEMPOTENCY_HEADER)?.trim() ||
    request.headers.get(CONTROL_PLANE_IDEMPOTENCY_ALT_HEADER)?.trim() ||
    null
  );
}

export function hashControlPlaneMutationRequest(value: unknown) {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

export function isControlPlaneIdempotencyConflictError(
  error: unknown,
): error is ControlPlaneIdempotencyConflictError {
  return error instanceof ControlPlaneIdempotencyConflictError;
}

export function findControlPlaneIdempotencyRecord(
  state: ControlPlaneState,
  params: {
    tenantId?: string | null;
    idempotencyKey: string;
  },
) {
  const tenantId = params.tenantId ?? activeControlPlaneTenantId();
  return (
    state.mutations.idempotency.find(
      (record) =>
        record.tenantId === tenantId &&
        record.idempotencyKey === params.idempotencyKey,
    ) ?? null
  );
}

export async function readControlPlaneIdempotentMutationResult<TResponse>(
  params: {
    tenantId?: string | null;
    idempotencyKey: string;
    requestHash: string;
  },
) {
  const state = await readControlPlaneState();
  const record = findControlPlaneIdempotencyRecord(state, params);
  if (!record) {
    return null;
  }

  if (record.requestHash !== params.requestHash) {
    throw new ControlPlaneIdempotencyConflictError(params.idempotencyKey);
  }

  return {
    statusCode: record.statusCode,
    responseJson: clone(record.responseJson) as TResponse,
  };
}

export function buildControlPlaneMutationEvent(params: {
  tenantId?: string | null;
  mutationKind: string;
  resourceKind: ControlPlaneMutationResourceKind;
  resourceId: string;
  idempotencyKey?: string | null;
  actorId?: string | null;
  requestHash?: string | null;
  payload?: Record<string, unknown>;
  responseJson?: Record<string, unknown> | null;
  statusCode?: number | null;
  occurredAt?: string;
}): ControlPlaneMutationEventRecord {
  const occurredAt = params.occurredAt ?? nowIso();
  return {
    id: `mutation-${occurredAt.replace(/[^0-9]/g, "")}-${createHash("sha1")
      .update(
        [
          params.tenantId ?? activeControlPlaneTenantId(),
          params.mutationKind,
          params.resourceKind,
          params.resourceId,
          params.idempotencyKey ?? "",
          params.requestHash ?? "",
        ].join(":"),
      )
      .digest("hex")
      .slice(0, 12)}`,
    tenantId: params.tenantId ?? activeControlPlaneTenantId(),
    mutationKind: params.mutationKind,
    resourceKind: params.resourceKind,
    resourceId: params.resourceId,
    idempotencyKey: params.idempotencyKey ?? null,
    actorId: params.actorId ?? null,
    requestHash: params.requestHash ?? null,
    payload: clone(params.payload ?? {}),
    responseJson: params.responseJson ? clone(params.responseJson) : null,
    statusCode: params.statusCode ?? null,
    occurredAt,
  };
}

export async function recordControlPlaneMutationResult(params: {
  tenantId?: string | null;
  idempotencyKey: string;
  requestHash: string;
  mutationKind: string;
  resourceKind: ControlPlaneMutationResourceKind;
  resourceId: string;
  actorId?: string | null;
  statusCode: number;
  payload?: Record<string, unknown>;
  responseJson: Record<string, unknown>;
}) {
  await updateControlPlaneState(
    (draft) => {
      const tenantId = params.tenantId ?? activeControlPlaneTenantId();
      const existing = findControlPlaneIdempotencyRecord(draft, {
        tenantId,
        idempotencyKey: params.idempotencyKey,
      });
      if (existing && existing.requestHash !== params.requestHash) {
        throw new ControlPlaneIdempotencyConflictError(params.idempotencyKey);
      }
      if (existing) {
        return;
      }

      const occurredAt = nowIso();
      const event = buildControlPlaneMutationEvent({
        ...params,
        tenantId,
        occurredAt,
      });
      const record: ControlPlaneIdempotencyRecord = {
        tenantId,
        idempotencyKey: params.idempotencyKey,
        requestHash: params.requestHash,
        mutationEventId: event.id,
        status: "completed",
        statusCode: params.statusCode,
        responseJson: clone(params.responseJson),
        createdAt: occurredAt,
        updatedAt: occurredAt,
      };

      draft.mutations.events = [event, ...draft.mutations.events];
      draft.mutations.idempotency = [
        record,
        ...draft.mutations.idempotency.filter(
          (candidate) =>
            !(
              candidate.tenantId === tenantId &&
              candidate.idempotencyKey === params.idempotencyKey
            ),
        ),
      ];
    },
    {
      lockTenantId: params.tenantId ?? activeControlPlaneTenantId(),
      lockResourceId: params.resourceId,
      buildRelationalDelta(nextState) {
        const record = findControlPlaneIdempotencyRecord(nextState, {
          tenantId: params.tenantId ?? activeControlPlaneTenantId(),
          idempotencyKey: params.idempotencyKey,
        });
        const event = record
          ? nextState.mutations.events.find(
              (candidate) => candidate.id === record.mutationEventId,
            ) ?? null
          : null;
        return {
          mutationEvents: event ? [event] : [],
          idempotencyRecords: record ? [record] : [],
        };
      },
    },
  );
}
