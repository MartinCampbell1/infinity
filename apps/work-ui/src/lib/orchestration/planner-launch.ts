import type { TaskGraphRecord } from '$lib/apis/orchestration/types';
import { createOrchestrationTaskGraph, getOrchestrationTaskGraphs } from '$lib/apis/orchestration/task-graphs';

type PlannerContext = {
	shellOrigin?: string | null;
	fetchImpl?: typeof fetch;
};

export const launchPlannerForBrief = async (
	briefId: string,
	context: PlannerContext = {}
) => {
	const response = await createOrchestrationTaskGraph(
		{ briefId },
		{
			shellOrigin: context.shellOrigin,
			fetchImpl: context.fetchImpl
		}
	);

	return response.taskGraph;
};

export const loadTaskGraphForBrief = async (
	briefId: string,
	context: PlannerContext = {}
): Promise<TaskGraphRecord | null> => {
	const response = await getOrchestrationTaskGraphs(
		{ briefId },
		{
			shellOrigin: context.shellOrigin,
			fetchImpl: context.fetchImpl
		}
	);

	return response.taskGraphs[0] ?? null;
};
