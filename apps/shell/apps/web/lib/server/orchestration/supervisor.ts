import { createExecutionKernelClient } from "@founderos/api-clients";

import type {
  SupervisorActionMutationResponse,
  SupervisorActionRequest,
  SupervisorActionsDirectoryResponse,
} from "../control-plane/contracts/orchestration";
import { readControlPlaneState, updateControlPlaneState } from "../control-plane/state/store";

import { buildExecutionBatchDetailResponse, findExecutionBatch, listSupervisorActionsForBatch, resolveExecutionKernelBaseUrl } from "./batches";
import {
  appendAutonomousRunEvent,
  findAutonomousRunByInitiativeId,
  materializeExecutionEvidence,
  syncAutonomousRunTimeline,
  updateAutonomousRunStage,
  upsertAgentSessionRecord,
} from "./autonomous-run";
import { materializeAttemptArtifacts } from "./attempt-artifacts";
import { findOrchestrationTaskGraph } from "./task-graphs";
import { findOrchestrationWorkUnit } from "./work-units";
import { buildOrchestrationDirectoryMeta, buildOrchestrationId, nowIso } from "./shared";
import { buildSupervisorActionRecord, cloneSupervisorAction } from "./supervisor-shared";

function classifySecretPause(
  errorSummary?: string | null,
  errorCode?: string | null
): "secret_required" | "credential_required" | null {
  const haystack = `${errorCode ?? ""} ${errorSummary ?? ""}`.toLowerCase();
  if (!haystack.trim()) {
    return null;
  }
  if (
    haystack.includes("credential") ||
    haystack.includes("oauth") ||
    haystack.includes("login") ||
    haystack.includes("auth token")
  ) {
    return "credential_required";
  }
  if (
    haystack.includes("secret") ||
    haystack.includes("api key") ||
    haystack.includes("token") ||
    haystack.includes("password")
  ) {
    return "secret_required";
  }
  return null;
}

export async function buildSupervisorActionsDirectoryResponse(filters?: {
  batchId?: string | null;
  taskGraphId?: string | null;
}): Promise<SupervisorActionsDirectoryResponse> {
  const state = await readControlPlaneState();
  const supervisorActions = [...state.orchestration.supervisorActions]
    .filter((action) => {
      if (filters?.batchId && action.batchId !== filters.batchId) {
        return false;
      }
      if (filters?.taskGraphId && action.taskGraphId !== filters.taskGraphId) {
        return false;
      }
      return true;
    })
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
    .map(cloneSupervisorAction);

  return {
    ...(await buildOrchestrationDirectoryMeta([
      "Supervisor actions are persisted in the shell and describe operator and system interventions for batch orchestration.",
    ])),
    supervisorActions,
  };
}

export async function performSupervisorAction(
  input: SupervisorActionRequest
): Promise<SupervisorActionMutationResponse | null> {
  const batch = await findExecutionBatch(input.batchId);
  if (!batch) {
    return null;
  }

  const workUnit = await findOrchestrationWorkUnit(input.workUnitId);
  if (!workUnit) {
    return null;
  }

  const taskGraph = await findOrchestrationTaskGraph(batch.taskGraphId);
  if (!taskGraph) {
    return null;
  }

  if (
    workUnit.taskGraphId !== batch.taskGraphId ||
    !batch.workUnitIds.includes(workUnit.id)
  ) {
    throw new Error(
      `Work unit ${workUnit.id} does not belong to batch ${batch.id}.`
    );
  }

  const occurredAt = nowIso();
  const kernel = createExecutionKernelClient({
    baseUrl: resolveExecutionKernelBaseUrl(),
  });

  if (input.actionKind === "complete_attempt") {
    const batchDetail = await kernel.getBatch(batch.id);
    const attempt = batchDetail.attempts.find(
      (candidate) =>
        candidate.id === input.attemptId && candidate.workUnitId === workUnit.id
    );
    if (!attempt) {
      throw new Error(
        `Attempt ${input.attemptId} does not belong to work unit ${workUnit.id} in batch ${batch.id}.`
      );
    }

    materializeAttemptArtifacts({
      initiativeId: batch.initiativeId,
      taskGraphId: batch.taskGraphId,
      batchId: batch.id,
      workUnit,
      attemptId: input.attemptId,
    });

    const completed = await kernel.completeAttempt(input.attemptId);

    await updateControlPlaneState((draft) => {
      draft.orchestration.batches = draft.orchestration.batches.map((candidate) =>
        candidate.id === batch.id
          ? {
              ...candidate,
              status: completed.batch.status,
              startedAt: completed.batch.startedAt ?? candidate.startedAt ?? null,
              finishedAt: completed.batch.finishedAt ?? candidate.finishedAt ?? null,
            }
          : candidate
      );
      draft.orchestration.workUnits = draft.orchestration.workUnits.map((candidate) =>
        candidate.id === workUnit.id
          ? {
              ...candidate,
              status: "completed",
              latestAttemptId: input.attemptId,
              updatedAt: occurredAt,
            }
          : candidate
      );
      draft.orchestration.supervisorActions = [
        buildSupervisorActionRecord({
          batchId: batch.id,
          initiativeId: batch.initiativeId,
          taskGraphId: batch.taskGraphId,
          workUnitId: workUnit.id,
          attemptId: input.attemptId,
          actionKind: "attempt.completed",
          actorType: "operator",
          actorId: "infinity-operator",
          summary: `Attempt ${input.attemptId} completed for ${workUnit.id}.`,
          fromStatus: batch.status,
          toStatus: completed.batch.status,
          payload: {
            attemptId: input.attemptId,
            workUnitId: workUnit.id,
          },
          occurredAt,
        }),
        ...draft.orchestration.supervisorActions,
      ];
      upsertAgentSessionRecord(draft, batch.initiativeId, {
        batchId: batch.id,
        workItemId: workUnit.id,
        attemptId: input.attemptId,
        status: "completed",
        runtimeRef: input.attemptId,
        finishedAt: occurredAt,
      });
      appendAutonomousRunEvent(draft, batch.initiativeId, {
        kind: "workitem.completed",
        stage: "executing",
        summary: `Work item ${workUnit.id} completed.`,
        payload: {
          batchId: batch.id,
          workUnitId: workUnit.id,
          attemptId: input.attemptId,
        },
      });
      appendAutonomousRunEvent(draft, batch.initiativeId, {
        kind: "agent.completed",
        stage: "executing",
        summary: `Agent attempt ${input.attemptId} completed.`,
        payload: {
          batchId: batch.id,
          workUnitId: workUnit.id,
          attemptId: input.attemptId,
        },
      });
    });
  }

  if (input.actionKind === "fail_attempt") {
    const batchDetail = await kernel.getBatch(batch.id);
    const attempt = batchDetail.attempts.find(
      (candidate) =>
        candidate.id === input.attemptId && candidate.workUnitId === workUnit.id
    );
    if (!attempt) {
      throw new Error(
        `Attempt ${input.attemptId} does not belong to work unit ${workUnit.id} in batch ${batch.id}.`
      );
    }

    const failed = await kernel.failAttempt(input.attemptId, {
      errorCode: input.errorCode ?? null,
      errorSummary: input.errorSummary ?? null,
    });
    const secretPauseKind = classifySecretPause(
      input.errorSummary ?? failed.attempt.errorSummary ?? null,
      input.errorCode ?? failed.attempt.errorCode ?? null
    );

    await updateControlPlaneState((draft) => {
      draft.orchestration.batches = draft.orchestration.batches.map((candidate) =>
        candidate.id === batch.id
          ? {
              ...candidate,
              status: failed.batch.status,
              startedAt: failed.batch.startedAt ?? candidate.startedAt ?? null,
              finishedAt: failed.batch.finishedAt ?? candidate.finishedAt ?? null,
            }
          : candidate
      );
      draft.orchestration.workUnits = draft.orchestration.workUnits.map((candidate) =>
        candidate.id === workUnit.id
          ? {
              ...candidate,
              status: "retryable",
              latestAttemptId: input.attemptId,
              updatedAt: occurredAt,
            }
          : candidate
      );
      draft.orchestration.supervisorActions = [
        buildSupervisorActionRecord({
          batchId: batch.id,
          initiativeId: batch.initiativeId,
          taskGraphId: batch.taskGraphId,
          workUnitId: workUnit.id,
          attemptId: input.attemptId,
          actionKind: "attempt.failed",
          actorType: "operator",
          actorId: "infinity-operator",
          summary: `Attempt ${input.attemptId} failed for ${workUnit.id}.`,
          fromStatus: batch.status,
          toStatus: "retryable",
          payload: {
            attemptId: input.attemptId,
            workUnitId: workUnit.id,
            errorCode: input.errorCode ?? null,
            errorSummary: input.errorSummary ?? null,
          },
          occurredAt,
        }),
        ...draft.orchestration.supervisorActions,
      ];
      upsertAgentSessionRecord(draft, batch.initiativeId, {
        batchId: batch.id,
        workItemId: workUnit.id,
        attemptId: input.attemptId,
        status: "failed",
        runtimeRef: input.attemptId,
        finishedAt: occurredAt,
      });
      draft.orchestration.refusals = [
        {
          id: buildOrchestrationId("refusal"),
          runId:
            findAutonomousRunByInitiativeId(draft, batch.initiativeId)?.id ??
            `run-missing-${batch.initiativeId}`,
          workItemId: workUnit.id,
          agentSessionId:
            draft.orchestration.agentSessions.find(
              (candidate) => candidate.attemptId === input.attemptId
            )?.id ?? null,
          reason: input.errorSummary ?? "Execution attempt failed.",
          severity: "medium",
          createdAt: occurredAt,
        },
        ...draft.orchestration.refusals,
      ];
      updateAutonomousRunStage(draft, batch.initiativeId, {
        stage: secretPauseKind ? "blocked" : "blocked",
        health: "blocked",
      });
      if (secretPauseKind) {
        draft.orchestration.secretPauses = [
          {
            id: buildOrchestrationId("secret-pause"),
            runId:
              findAutonomousRunByInitiativeId(draft, batch.initiativeId)?.id ??
              `run-missing-${batch.initiativeId}`,
            kind: secretPauseKind,
            message:
              input.errorSummary ??
              failed.attempt.errorSummary ??
              "Secrets or credentials are required before the run can continue.",
            createdAt: occurredAt,
            resolvedAt: null,
          },
          ...draft.orchestration.secretPauses,
        ];
        appendAutonomousRunEvent(draft, batch.initiativeId, {
          kind: "run.blocked",
          stage: "blocked",
          summary:
            secretPauseKind === "credential_required"
              ? "Run blocked pending credentials."
              : "Run blocked pending secrets.",
          payload: {
            batchId: batch.id,
            workUnitId: workUnit.id,
            attemptId: input.attemptId,
            kind: secretPauseKind,
          },
        });
      }
      appendAutonomousRunEvent(draft, batch.initiativeId, {
        kind: "agent.failed",
        stage: "blocked",
        summary: `Agent attempt ${input.attemptId} failed for ${workUnit.id}.`,
        payload: {
          batchId: batch.id,
          workUnitId: workUnit.id,
          attemptId: input.attemptId,
          errorCode: input.errorCode ?? null,
          errorSummary: input.errorSummary ?? null,
        },
      });
      appendAutonomousRunEvent(draft, batch.initiativeId, {
        kind: "refusal.created",
        stage: "blocked",
        summary: `Recovery/refusal object created for ${workUnit.id}.`,
        payload: {
          batchId: batch.id,
          workUnitId: workUnit.id,
          attemptId: input.attemptId,
        },
      });
    });
  }

  if (input.actionKind === "reassign_work_unit") {
    await updateControlPlaneState((draft) => {
      draft.orchestration.workUnits = draft.orchestration.workUnits.map((candidate) =>
        candidate.id === workUnit.id
          ? {
              ...candidate,
              executorType: input.executorType,
              status:
                candidate.status === "retryable" || candidate.status === "blocked"
                  ? "ready"
                  : candidate.status,
              updatedAt: occurredAt,
            }
          : candidate
      );
      draft.orchestration.supervisorActions = [
        buildSupervisorActionRecord({
          batchId: batch.id,
          initiativeId: batch.initiativeId,
          taskGraphId: batch.taskGraphId,
          workUnitId: workUnit.id,
          actionKind: "work_unit.reassigned",
          actorType: "operator",
          actorId: "infinity-operator",
          summary: `Work unit ${workUnit.id} reassigned to ${input.executorType}.`,
          fromStatus: workUnit.status,
          toStatus: "ready",
          payload: {
            workUnitId: workUnit.id,
            executorType: input.executorType,
          },
          occurredAt,
        }),
        ...draft.orchestration.supervisorActions,
      ];
      updateAutonomousRunStage(draft, batch.initiativeId, {
        stage: "queued",
        health: "degraded",
        operatorOverrideActive: true,
      });
      appendAutonomousRunEvent(draft, batch.initiativeId, {
        kind: "recovery.reroute.started",
        stage: "queued",
        summary: `Work item ${workUnit.id} rerouted to ${input.executorType}.`,
        payload: {
          batchId: batch.id,
          workUnitId: workUnit.id,
          executorType: input.executorType,
        },
      });
    });
  }

  const detail = await buildExecutionBatchDetailResponse(batch.id);
  if (!detail) {
    return null;
  }

  const nextWorkUnit =
    detail.workUnits.find((candidate) => candidate.id === workUnit.id) ??
    (await findOrchestrationWorkUnit(workUnit.id));
  if (!nextWorkUnit) {
    return null;
  }

  const nextState = await readControlPlaneState();
  const run = findAutonomousRunByInitiativeId(nextState, batch.initiativeId);
  if (run) {
    const currentWorkUnits = detail.workUnits;
    const currentAgentSessions = nextState.orchestration.agentSessions.filter(
      (candidate) => candidate.batchId === batch.id
    );
    materializeExecutionEvidence(run, detail.batch, currentWorkUnits, currentAgentSessions);
    syncAutonomousRunTimeline(nextState, batch.initiativeId);
  }

  return {
    ...(await buildOrchestrationDirectoryMeta([
      `Supervisor action ${input.actionKind} was applied to batch ${batch.id}.`,
    ])),
    batch: detail.batch,
    taskGraph: detail.taskGraph,
    workUnit: nextWorkUnit,
    attempts: detail.attempts,
    supervisorActions: await listSupervisorActionsForBatch(batch.id),
  };
}
