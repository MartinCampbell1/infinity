import type {
	CreateExecutionBatchRequest,
	ExecutionBatchDetailResponse,
	ExecutionBatchMutationResponse,
	ExecutionBatchesDirectoryResponse
} from './types';
import type { ShellApiContext } from './shared';
import { requestShellOrchestration } from './shared';

export const getOrchestrationBatches = (
	filters?: { initiativeId?: string | null; taskGraphId?: string | null },
	context?: ShellApiContext
) => {
	const searchParams = new URLSearchParams();
	if (filters?.initiativeId) {
		searchParams.set('initiative_id', filters.initiativeId);
	}
	if (filters?.taskGraphId) {
		searchParams.set('task_graph_id', filters.taskGraphId);
	}

	const query = searchParams.toString();
	return requestShellOrchestration<ExecutionBatchesDirectoryResponse>(
		`/batches${query ? `?${query}` : ''}`,
		{ context }
	);
};

export const getOrchestrationBatch = (batchId: string, context?: ShellApiContext) =>
	requestShellOrchestration<ExecutionBatchDetailResponse>(
		`/batches/${encodeURIComponent(batchId)}`,
		{
			context
		}
	);

export const createOrchestrationBatch = (
	body: CreateExecutionBatchRequest,
	context?: ShellApiContext
) =>
	requestShellOrchestration<ExecutionBatchMutationResponse>('/batches', {
		method: 'POST',
		body,
		context
	});
