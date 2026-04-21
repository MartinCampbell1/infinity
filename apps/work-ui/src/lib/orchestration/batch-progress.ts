import { getOrchestrationBatch, getOrchestrationBatches } from '$lib/apis/orchestration/batches';
import type { ExecutionBatchDetailResponse } from '$lib/apis/orchestration/types';

type BatchProgressContext = {
	shellOrigin?: string | null;
	fetchImpl?: typeof fetch;
};

export const loadLatestBatchProgress = async (
	taskGraphId: string,
	context: BatchProgressContext = {}
): Promise<ExecutionBatchDetailResponse | null> => {
	try {
		const batches = await getOrchestrationBatches(
			{ taskGraphId },
			{
				shellOrigin: context.shellOrigin,
				fetchImpl: context.fetchImpl
			}
		);

		const latestBatch = batches.batches[0];
		if (!latestBatch) {
			return null;
		}

		return getOrchestrationBatch(latestBatch.id, {
			shellOrigin: context.shellOrigin,
			fetchImpl: context.fetchImpl
		});
	} catch {
		return null;
	}
};

export const summarizeBatchProgress = (
	progress:
		| Pick<ExecutionBatchDetailResponse, 'batch' | 'attempts' | 'supervisorActions'>
		| null
) => {
	if (!progress) {
		return null;
	}

	return {
		label: progress.batch.status,
		attempts: progress.attempts.length,
		failures: progress.attempts.filter((attempt) => attempt.status === 'failed').length,
		supervisorActions: progress.supervisorActions.length
	};
};
