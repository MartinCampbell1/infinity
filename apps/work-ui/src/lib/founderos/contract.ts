import type {
	HostToWorkspaceMessage,
	SessionWorkspaceHostContext
} from '$lib/founderos/types';

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null;

const isString = (value: unknown): value is string => typeof value === 'string';

const isNonEmptyString = (value: unknown): value is string =>
	isString(value) && value.trim().length > 0;

const isOptionalString = (value: unknown): value is string | null | undefined =>
	value === undefined || value === null || isString(value);

const isExecutionMode = (
	value: unknown
): value is SessionWorkspaceHostContext['executionMode'] =>
	value === undefined ||
	value === 'local' ||
	value === 'worktree' ||
	value === 'cloud' ||
	value === 'hermes' ||
	value === 'unknown';

const isOpenedFrom = (value: unknown): value is SessionWorkspaceHostContext['openedFrom'] =>
	value === 'dashboard' ||
	value === 'execution_board' ||
	value === 'review' ||
	value === 'group_board' ||
	value === 'deep_link' ||
	value === 'unknown';

const isQuotaPressure = (
	value: unknown
): value is NonNullable<SessionWorkspaceHostContext['quotaState']>['pressure'] =>
	value === 'low' ||
	value === 'medium' ||
	value === 'high' ||
	value === 'exhausted' ||
	value === 'unknown';

const isQuotaState = (value: unknown) => {
	if (value === undefined) {
		return true;
	}
	if (!isRecord(value)) {
		return false;
	}
	return (
		isQuotaPressure(value.pressure) &&
		(value.usedPercent === undefined || value.usedPercent === null || typeof value.usedPercent === 'number') &&
		isOptionalString(value.resetsAt)
	);
};

const hasValidSessionWorkspaceCoreFields = (value: Record<string, unknown>) =>
	isNonEmptyString(value.projectId) &&
	isNonEmptyString(value.projectName) &&
	isNonEmptyString(value.sessionId) &&
	isOpenedFrom(value.openedFrom);

const hasValidSessionWorkspaceOptionalFields = (value: Record<string, unknown>) =>
	isOptionalString(value.externalSessionId) &&
	isOptionalString(value.groupId) &&
	isOptionalString(value.workspaceId) &&
	isOptionalString(value.accountId) &&
	isOptionalString(value.accountLabel) &&
	isOptionalString(value.model) &&
	isExecutionMode(value.executionMode) &&
	isQuotaState(value.quotaState) &&
	(value.pendingApprovals === undefined ||
		value.pendingApprovals === null ||
		typeof value.pendingApprovals === 'number');

export const isSessionWorkspaceHostContext = (
	value: unknown
): value is SessionWorkspaceHostContext => {
	if (!isRecord(value)) {
		return false;
	}
	return (
		hasValidSessionWorkspaceCoreFields(value) &&
		hasValidSessionWorkspaceOptionalFields(value)
	);
};

export const isSessionWorkspaceHostContextPatch = (
	value: unknown
): value is Partial<SessionWorkspaceHostContext> => {
	if (!isRecord(value)) {
		return false;
	}

	if (value.projectId !== undefined && !isNonEmptyString(value.projectId)) {
		return false;
	}
	if (value.projectName !== undefined && !isNonEmptyString(value.projectName)) {
		return false;
	}
	if (value.sessionId !== undefined && !isNonEmptyString(value.sessionId)) {
		return false;
	}
	if (value.openedFrom !== undefined && !isOpenedFrom(value.openedFrom)) {
		return false;
	}

	return hasValidSessionWorkspaceOptionalFields(value);
};

export const isHostToWorkspaceMessage = (value: unknown): value is HostToWorkspaceMessage => {
	if (!isRecord(value) || !isString(value.type)) {
		return false;
	}

	switch (value.type) {
		case 'founderos.bootstrap':
			return isSessionWorkspaceHostContext(value.payload);
		case 'founderos.account.switch':
			return isRecord(value.payload) && isNonEmptyString(value.payload.accountId);
		case 'founderos.session.retry':
			return (
				isRecord(value.payload) &&
				(value.payload.retryMode === 'same_account' ||
					value.payload.retryMode === 'fallback_account')
			);
		case 'founderos.session.focus':
			return (
				isRecord(value.payload) &&
				(value.payload.section === 'chat' ||
					value.payload.section === 'files' ||
					value.payload.section === 'approvals' ||
					value.payload.section === 'diff')
			);
		case 'founderos.session.meta':
			return isSessionWorkspaceHostContextPatch(value.payload);
		default:
			return false;
	}
};
