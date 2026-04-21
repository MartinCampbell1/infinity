import type {
	SupervisorActionMutationResponse,
	SupervisorActionRequest
} from './types';
import type { ShellApiContext } from './shared';
import { requestShellOrchestration } from './shared';

export const createSupervisorAction = (
	body: SupervisorActionRequest,
	context?: ShellApiContext
) =>
	requestShellOrchestration<SupervisorActionMutationResponse>('/supervisor/actions', {
		method: 'POST',
		body,
		context
	});
