import type {
  CreateProjectBriefRequest,
  InitiativeRecord,
  ProjectBriefDetailResponse,
  ProjectBriefMutationResponse,
  ProjectBriefRecord,
  ProjectBriefsDirectoryResponse,
  UpdateProjectBriefRequest,
} from "../control-plane/contracts/orchestration";
import { readControlPlaneState, updateControlPlaneState } from "../control-plane/state/store";
import { findTaskGraphByBriefId } from "./task-graphs";
import {
  appendAutonomousRunEvent,
  findAutonomousRunByInitiativeId,
  materializeSpecEvidence,
  syncAutonomousRunTimeline,
  updateAutonomousRunStage,
  upsertSpecDocRecord,
} from "./autonomous-run";

import {
  buildOrchestrationDirectoryMeta,
  buildOrchestrationId,
  normalizeClarificationLog,
  normalizeStringList,
  nowIso,
  sortByUpdatedAtDesc,
  trimRequiredString,
} from "./shared";

function cloneBrief(value: ProjectBriefRecord) {
  return JSON.parse(JSON.stringify(value)) as ProjectBriefRecord;
}

function cloneInitiative(value: InitiativeRecord | null) {
  return value ? (JSON.parse(JSON.stringify(value)) as InitiativeRecord) : null;
}

export async function listOrchestrationBriefs() {
  const state = await readControlPlaneState();
  return sortByUpdatedAtDesc(state.orchestration.briefs).map(cloneBrief);
}

export async function findOrchestrationBrief(briefId: string) {
  return (await listOrchestrationBriefs()).find((brief) => brief.id === briefId) ?? null;
}

async function findInitiative(initiativeId: string) {
  const state = await readControlPlaneState();
  return (
    state.orchestration.initiatives.find((initiative) => initiative.id === initiativeId) ?? null
  );
}

export async function buildProjectBriefsDirectoryResponse(): Promise<ProjectBriefsDirectoryResponse> {
  return {
    ...(await buildOrchestrationDirectoryMeta([
      "Briefs are stored in the shell-owned orchestration slice.",
    ])),
    briefs: await listOrchestrationBriefs(),
  };
}

export async function buildProjectBriefDetailResponse(
  briefId: string
): Promise<ProjectBriefDetailResponse | null> {
  const brief = await findOrchestrationBrief(briefId);
  if (!brief) {
    return null;
  }

  return {
    ...(await buildOrchestrationDirectoryMeta([
      `Brief ${briefId} is resolved from the shell-owned orchestration slice.`,
    ])),
    brief,
    initiative: cloneInitiative(await findInitiative(brief.initiativeId)),
  };
}

export async function buildProjectBriefMutationResponse(
  briefId: string
): Promise<ProjectBriefMutationResponse | null> {
  const detail = await buildProjectBriefDetailResponse(briefId);
  if (!detail) {
    return null;
  }

  return {
    ...detail,
    taskGraph: await findTaskGraphByBriefId(briefId),
  };
}

export async function createOrchestrationBrief(input: CreateProjectBriefRequest) {
  const initiative = await findInitiative(input.initiativeId);
  if (!initiative) {
    return { brief: null, initiative: null } as const;
  }

  const occurredAt = nowIso();
  const nextStatus = input.status ?? "clarifying";
  const brief: ProjectBriefRecord = {
    id: buildOrchestrationId("brief"),
    initiativeId: input.initiativeId,
    summary: trimRequiredString(input.summary),
    goals: normalizeStringList(input.goals),
    nonGoals: normalizeStringList(input.nonGoals),
    constraints: normalizeStringList(input.constraints),
    assumptions: normalizeStringList(input.assumptions),
    acceptanceCriteria: normalizeStringList(input.acceptanceCriteria),
    repoScope: normalizeStringList(input.repoScope),
    deliverables: normalizeStringList(input.deliverables),
    clarificationLog: normalizeClarificationLog(input.clarificationLog),
    status: nextStatus,
    authoredBy: trimRequiredString(input.authoredBy),
    createdAt: occurredAt,
    updatedAt: occurredAt,
  };

  let updatedInitiative: InitiativeRecord | null = null;

  await updateControlPlaneState((draft) => {
    draft.orchestration.briefs = [brief, ...draft.orchestration.briefs];
    appendAutonomousRunEvent(draft, input.initiativeId, {
      kind: "spec.created",
      stage: "specing",
      summary: `Spec draft ${brief.id} created.`,
      payload: {
        briefId: brief.id,
        authoredBy: brief.authoredBy,
      },
    });

    if (nextStatus === "approved") {
      draft.orchestration.initiatives = draft.orchestration.initiatives.map((candidate) => {
        if (candidate.id !== input.initiativeId) {
          return candidate;
        }

        updatedInitiative = {
          ...candidate,
          status: "brief_ready",
          updatedAt: occurredAt,
        };
        return updatedInitiative;
      });
      updateAutonomousRunStage(draft, input.initiativeId, {
        stage: "planning",
      });
      appendAutonomousRunEvent(draft, input.initiativeId, {
        kind: "spec.ready",
        stage: "planning",
        summary: `Spec ${brief.id} is ready for planning.`,
        payload: {
          briefId: brief.id,
        },
      });
      appendAutonomousRunEvent(draft, input.initiativeId, {
        kind: "run.stage.changed",
        stage: "planning",
        summary: "Run advanced from specing to planning.",
        payload: {
          fromStage: "specing",
          toStage: "planning",
        },
      });
    }
  });

  const state = await readControlPlaneState();
  const run = findAutonomousRunByInitiativeId(state, input.initiativeId);
  if (run) {
    const artifacts = materializeSpecEvidence(run, brief);
    await updateControlPlaneState((draft) => {
      upsertSpecDocRecord(draft, input.initiativeId, brief, artifacts.specMdPath);
    });
    syncAutonomousRunTimeline(await readControlPlaneState(), input.initiativeId);
  }

  return {
    brief: cloneBrief(brief),
    initiative: cloneInitiative(updatedInitiative ?? initiative),
    taskGraph: null,
  } as const;
}

export async function updateOrchestrationBrief(
  briefId: string,
  patch: UpdateProjectBriefRequest
) {
  let updatedBrief: ProjectBriefRecord | null = null;
  let updatedInitiative: InitiativeRecord | null = null;
  const occurredAt = nowIso();

  await updateControlPlaneState((draft) => {
    const index = draft.orchestration.briefs.findIndex((brief) => brief.id === briefId);
    if (index < 0) {
      return;
    }

    const current = draft.orchestration.briefs[index];
    if (!current) {
      return;
    }

    const next: ProjectBriefRecord = {
      ...current,
      summary: patch.summary !== undefined ? trimRequiredString(patch.summary) : current.summary,
      goals: patch.goals !== undefined ? normalizeStringList(patch.goals) : current.goals,
      nonGoals:
        patch.nonGoals !== undefined ? normalizeStringList(patch.nonGoals) : current.nonGoals,
      constraints:
        patch.constraints !== undefined
          ? normalizeStringList(patch.constraints)
          : current.constraints,
      assumptions:
        patch.assumptions !== undefined
          ? normalizeStringList(patch.assumptions)
          : current.assumptions,
      acceptanceCriteria:
        patch.acceptanceCriteria !== undefined
          ? normalizeStringList(patch.acceptanceCriteria)
          : current.acceptanceCriteria,
      repoScope:
        patch.repoScope !== undefined ? normalizeStringList(patch.repoScope) : current.repoScope,
      deliverables:
        patch.deliverables !== undefined
          ? normalizeStringList(patch.deliverables)
          : current.deliverables,
      clarificationLog:
        patch.clarificationLog !== undefined
          ? normalizeClarificationLog(patch.clarificationLog)
          : current.clarificationLog,
      status: patch.status ?? current.status,
      authoredBy:
        patch.authoredBy !== undefined
          ? trimRequiredString(patch.authoredBy)
          : current.authoredBy,
      updatedAt: occurredAt,
    };

    draft.orchestration.briefs = draft.orchestration.briefs.map((brief) =>
      brief.id === briefId ? next : brief
    );
    updatedBrief = next;
    appendAutonomousRunEvent(draft, next.initiativeId, {
      kind: "spec.updated",
      stage: next.status === "approved" ? "planning" : "specing",
      summary: `Spec ${next.id} was updated.`,
      payload: {
        briefId: next.id,
        status: next.status,
      },
    });

    if (next.status === "approved") {
      draft.orchestration.initiatives = draft.orchestration.initiatives.map((initiative) => {
        if (initiative.id !== next.initiativeId) {
          return initiative;
        }

        const hasExistingTaskGraph = draft.orchestration.taskGraphs.some(
          (taskGraph) =>
            taskGraph.initiativeId === next.initiativeId || taskGraph.briefId === next.id
        );

        updatedInitiative = {
          ...initiative,
          status: hasExistingTaskGraph
            ? initiative.status === "planning" ||
              initiative.status === "running" ||
              initiative.status === "assembly" ||
              initiative.status === "verifying" ||
              initiative.status === "ready" ||
              initiative.status === "failed"
              ? initiative.status
              : "brief_ready"
            : "brief_ready",
          updatedAt: occurredAt,
        };
        return updatedInitiative;
      });
      updateAutonomousRunStage(draft, next.initiativeId, {
        stage: "planning",
      });
      appendAutonomousRunEvent(draft, next.initiativeId, {
        kind: "spec.ready",
        stage: "planning",
        summary: `Spec ${next.id} is ready for planning.`,
        payload: {
          briefId: next.id,
        },
      });
    } else {
      updatedInitiative =
        draft.orchestration.initiatives.find(
          (initiative) => initiative.id === next.initiativeId
        ) ?? null;
    }
  });

  const updatedBriefSnapshot = updatedBrief ? cloneBrief(updatedBrief) : null;
  const taskGraph =
    updatedBriefSnapshot && updatedBriefSnapshot.status === "approved"
      ? await findTaskGraphByBriefId(updatedBriefSnapshot.id)
      : null;

  if (updatedBriefSnapshot) {
    const state = await readControlPlaneState();
    const run = findAutonomousRunByInitiativeId(state, updatedBriefSnapshot.initiativeId);
    if (run) {
      const artifacts = materializeSpecEvidence(run, updatedBriefSnapshot);
      await updateControlPlaneState((draft) => {
        upsertSpecDocRecord(
          draft,
          updatedBriefSnapshot.initiativeId,
          updatedBriefSnapshot,
          artifacts.specMdPath
        );
      });
      syncAutonomousRunTimeline(await readControlPlaneState(), updatedBriefSnapshot.initiativeId);
    }
  }

  return {
    brief: updatedBriefSnapshot,
    initiative: cloneInitiative(updatedInitiative),
    taskGraph,
  } as const;
}
