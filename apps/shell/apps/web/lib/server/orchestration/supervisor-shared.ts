import type { SupervisorActionKind, SupervisorActionRecord } from "../control-plane/contracts/orchestration";

import { buildOrchestrationId, nowIso } from "./shared";

export function cloneSupervisorAction(value: SupervisorActionRecord) {
	return JSON.parse(JSON.stringify(value)) as SupervisorActionRecord;
}

export function buildSupervisorActionRecord(input: {
	batchId: string;
	initiativeId: string;
	taskGraphId: string;
	workUnitId?: string | null;
	attemptId?: string | null;
	actionKind: SupervisorActionKind;
	actorType: "operator" | "system";
	actorId?: string | null;
	summary: string;
	fromStatus?: string | null;
	toStatus?: string | null;
	payload?: Record<string, unknown>;
	occurredAt?: string;
}) {
	return {
		id: buildOrchestrationId("supervisor-action"),
		batchId: input.batchId,
		initiativeId: input.initiativeId,
		taskGraphId: input.taskGraphId,
		workUnitId: input.workUnitId ?? null,
		attemptId: input.attemptId ?? null,
		actionKind: input.actionKind,
		actorType: input.actorType,
		actorId: input.actorId ?? null,
		occurredAt: input.occurredAt ?? nowIso(),
		summary: input.summary,
		fromStatus: input.fromStatus ?? null,
		toStatus: input.toStatus ?? null,
		payload: input.payload ?? {},
	} satisfies SupervisorActionRecord;
}
