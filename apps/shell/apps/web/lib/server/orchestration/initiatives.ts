import type {
  CreateInitiativeRequest,
  InitiativeDetailResponse,
  InitiativeMutationResponse,
  InitiativeRecord,
  InitiativesDirectoryResponse,
  UpdateInitiativeRequest,
} from "../control-plane/contracts/orchestration";
import { readControlPlaneState, updateControlPlaneState } from "../control-plane/state/store";
import {
  appendAutonomousRunEvent,
  ensureAutonomousRunRecord,
  findAutonomousRunByInitiativeId,
  materializeIntakeEvidence,
  syncAutonomousRunTimeline,
} from "./autonomous-run";

import {
  buildOrchestrationDirectoryMeta,
  buildOrchestrationId,
  nowIso,
  sortByUpdatedAtDesc,
  trimOptionalString,
  trimRequiredString,
} from "./shared";

function cloneInitiative(value: InitiativeRecord) {
  return JSON.parse(JSON.stringify(value)) as InitiativeRecord;
}

export async function listOrchestrationInitiatives() {
  const state = await readControlPlaneState();
  return sortByUpdatedAtDesc(state.orchestration.initiatives).map(cloneInitiative);
}

export async function listBriefsForInitiative(initiativeId: string) {
  const state = await readControlPlaneState();
  return sortByUpdatedAtDesc(
    state.orchestration.briefs.filter((brief) => brief.initiativeId === initiativeId)
  ).map((brief) => JSON.parse(JSON.stringify(brief)));
}

export async function findOrchestrationInitiative(initiativeId: string) {
  return (
    (await listOrchestrationInitiatives()).find((initiative) => initiative.id === initiativeId) ??
    null
  );
}

export async function buildInitiativesDirectoryResponse(): Promise<InitiativesDirectoryResponse> {
  return {
    ...(await buildOrchestrationDirectoryMeta([
      "Initiatives are stored in the shell-owned orchestration slice.",
    ])),
    initiatives: await listOrchestrationInitiatives(),
  };
}

export async function buildInitiativeDetailResponse(
  initiativeId: string
): Promise<InitiativeDetailResponse | null> {
  const initiative = await findOrchestrationInitiative(initiativeId);
  if (!initiative) {
    return null;
  }

  return {
    ...(await buildOrchestrationDirectoryMeta([
      `Initiative ${initiativeId} is resolved from the shell-owned orchestration slice.`,
    ])),
    initiative,
    briefs: await listBriefsForInitiative(initiativeId),
  };
}

export async function buildInitiativeMutationResponse(
  initiativeId: string
): Promise<InitiativeMutationResponse | null> {
  return buildInitiativeDetailResponse(initiativeId);
}

export async function createOrchestrationInitiative(input: CreateInitiativeRequest) {
  const occurredAt = nowIso();
  const initiative: InitiativeRecord = {
    id: buildOrchestrationId("initiative"),
    title: trimRequiredString(input.title),
    userRequest: trimRequiredString(input.userRequest),
    requestedBy: trimRequiredString(input.requestedBy),
    workspaceSessionId:
      trimOptionalString(input.workspaceSessionId) ?? buildOrchestrationId("session"),
    priority: input.priority ?? "normal",
    status: "clarifying",
    createdAt: occurredAt,
    updatedAt: occurredAt,
  };

  await updateControlPlaneState((draft) => {
    draft.orchestration.initiatives = [initiative, ...draft.orchestration.initiatives];
    ensureAutonomousRunRecord(draft, initiative);
    appendAutonomousRunEvent(draft, initiative.id, {
      kind: "run.created",
      stage: "intake",
      summary: `Run created for ${initiative.title}.`,
      payload: {
        requestedBy: initiative.requestedBy,
        priority: initiative.priority ?? "normal",
      },
    });
    appendAutonomousRunEvent(draft, initiative.id, {
      kind: "run.stage.changed",
      stage: "specing",
      summary: "Run advanced to specing automatically after intake.",
      payload: {
        fromStage: "intake",
        toStage: "specing",
      },
    });
  });

  const state = await readControlPlaneState();
  const run = findAutonomousRunByInitiativeId(state, initiative.id);
  if (run) {
    materializeIntakeEvidence(run, initiative);
    syncAutonomousRunTimeline(state, initiative.id);
  }

  return cloneInitiative(initiative);
}

export async function updateOrchestrationInitiative(
  initiativeId: string,
  patch: UpdateInitiativeRequest
) {
  let updated: InitiativeRecord | null = null;
  const occurredAt = nowIso();

  await updateControlPlaneState((draft) => {
    const index = draft.orchestration.initiatives.findIndex(
      (initiative) => initiative.id === initiativeId
    );
    if (index < 0) {
      return;
    }

    const current = draft.orchestration.initiatives[index];
    if (!current) {
      return;
    }

    const next: InitiativeRecord = {
      ...current,
      title: patch.title !== undefined ? trimRequiredString(patch.title) : current.title,
      userRequest:
        patch.userRequest !== undefined
          ? trimRequiredString(patch.userRequest)
          : current.userRequest,
      requestedBy:
        patch.requestedBy !== undefined
          ? trimRequiredString(patch.requestedBy)
          : current.requestedBy,
      workspaceSessionId:
        patch.workspaceSessionId !== undefined
          ? trimOptionalString(patch.workspaceSessionId)
          : current.workspaceSessionId ?? null,
      priority: patch.priority ?? current.priority,
      status: patch.status ?? current.status,
      updatedAt: occurredAt,
    };

    draft.orchestration.initiatives = draft.orchestration.initiatives.map((initiative) =>
      initiative.id === initiativeId ? next : initiative
    );
    updated = next;
  });

  return updated ? cloneInitiative(updated) : null;
}
