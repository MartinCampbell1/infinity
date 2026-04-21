import type { DeliveriesDirectoryResponse, DeliveryMutationResponse } from './types';
import type { ShellApiContext } from './shared';
import { requestShellOrchestration } from './shared';

export const getOrchestrationDeliveries = (
	filters?: { initiativeId?: string | null },
	context?: ShellApiContext
) => {
	const searchParams = new URLSearchParams();
	if (filters?.initiativeId) {
		searchParams.set('initiative_id', filters.initiativeId);
	}

	const query = searchParams.toString();
	return requestShellOrchestration<DeliveriesDirectoryResponse>(
		`/delivery${query ? `?${query}` : ''}`,
		{ context }
	);
};

export const createOrchestrationDelivery = (
	body: { initiativeId: string },
	context?: ShellApiContext
) =>
	requestShellOrchestration<DeliveryMutationResponse>('/delivery', {
		method: 'POST',
		body,
		context
	});
