import type {
	CreateTaskGraphRequest,
	TaskGraphDetailResponse,
	TaskGraphMutationResponse,
	TaskGraphsDirectoryResponse
} from './types';
import type { ShellApiContext } from './shared';
import { requestShellOrchestration } from './shared';

export const getOrchestrationTaskGraphs = (
	filters?: { initiativeId?: string | null; briefId?: string | null },
	context?: ShellApiContext
) => {
	const searchParams = new URLSearchParams();
	if (filters?.initiativeId) {
		searchParams.set('initiative_id', filters.initiativeId);
	}
	if (filters?.briefId) {
		searchParams.set('brief_id', filters.briefId);
	}

	const query = searchParams.toString();
	return requestShellOrchestration<TaskGraphsDirectoryResponse>(
		`/task-graphs${query ? `?${query}` : ''}`,
		{ context }
	);
};

export const getOrchestrationTaskGraph = (
	taskGraphId: string,
	context?: ShellApiContext
) =>
	requestShellOrchestration<TaskGraphDetailResponse>(
		`/task-graphs/${encodeURIComponent(taskGraphId)}`,
		{
			context
		}
	);

export const createOrchestrationTaskGraph = (
	body: CreateTaskGraphRequest,
	context?: ShellApiContext
) =>
	requestShellOrchestration<TaskGraphMutationResponse>('/task-graphs', {
		method: 'POST',
		body,
		context
	});
