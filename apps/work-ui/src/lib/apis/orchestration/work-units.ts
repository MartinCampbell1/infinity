import type {
	CreateWorkUnitRequest,
	UpdateWorkUnitRequest,
	WorkUnitDetailResponse,
	WorkUnitMutationResponse,
	WorkUnitsDirectoryResponse
} from './types';
import type { ShellApiContext } from './shared';
import { requestShellOrchestration } from './shared';

export const getOrchestrationWorkUnits = (
	filters?: { taskGraphId?: string | null },
	context?: ShellApiContext
) => {
	const searchParams = new URLSearchParams();
	if (filters?.taskGraphId) {
		searchParams.set('task_graph_id', filters.taskGraphId);
	}

	const query = searchParams.toString();
	return requestShellOrchestration<WorkUnitsDirectoryResponse>(
		`/work-units${query ? `?${query}` : ''}`,
		{ context }
	);
};

export const getOrchestrationWorkUnit = (
	workUnitId: string,
	context?: ShellApiContext
) =>
	requestShellOrchestration<WorkUnitDetailResponse>(
		`/work-units/${encodeURIComponent(workUnitId)}`,
		{
			context
		}
	);

export const createOrchestrationWorkUnit = (
	body: CreateWorkUnitRequest,
	context?: ShellApiContext
) =>
	requestShellOrchestration<WorkUnitMutationResponse>('/work-units', {
		method: 'POST',
		body,
		context
	});

export const updateOrchestrationWorkUnit = (
	workUnitId: string,
	body: UpdateWorkUnitRequest,
	context?: ShellApiContext
) =>
	requestShellOrchestration<WorkUnitMutationResponse>(
		`/work-units/${encodeURIComponent(workUnitId)}`,
		{
			method: 'PATCH',
			body,
			context
		}
	);
