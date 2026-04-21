export const getHermesStatusEntries = (message: any): any[] => {
	if (Array.isArray(message?.statusHistory)) {
		return message.statusHistory;
	}

	return message?.status ? [message.status] : [];
};

const HERMES_TOOL_STATUS_ACTION = 'hermes_tool';
const LIVE_HERMES_TOOL_EXECUTION_PREFIX = 'hermes-live-tool-';
const HERMES_APPROVAL_EVENT_ALIASES = new Set([
	'approval',
	'approval.pending',
	'approval.requested',
	'approval.required',
	'approval-needed',
	'approval_needed',
	'needs_approval',
	'needs-approval'
]);
const HERMES_APPROVAL_RESOLVED_EVENT_ALIASES = new Set([
	'approval.resolved',
	'approval.approved',
	'approval.denied',
	'approval.rejected'
]);
const HERMES_TOOL_EVENT_ALIASES = new Set([
	'tool',
	'tool.started',
	'tool.running',
	'tool.progress',
	'tool.finished',
	'tool.completed',
	'tool.result',
	'tool.error',
	'tool.failed'
]);

const TOOL_PREFIX_PATTERN = /^\[Tool:\s*([^\]]+)\]\s*/i;

const TOOL_RESULT_KEYS = [
	'content',
	'error',
	'exitCode',
	'exit_code',
	'files',
	'matches',
	'message',
	'mode',
	'output',
	'query',
	'result',
	'results',
	'stderr',
	'stdout',
	'success',
	'summary',
	'total_count'
];

const getFirstNonEmptyLine = (value: string) =>
	value
		.split(/\r?\n/)
		.map((line) => line.trim())
		.find(Boolean) || '';

const toToolSummaryText = (value: unknown): string => {
	if (typeof value === 'string') {
		return value.trim();
	}

	if (typeof value === 'number' || typeof value === 'boolean') {
		return String(value);
	}

	return '';
};

const getHermesToolEventName = (toolEvent: any) => {
	if (typeof toolEvent?.name === 'string' && toolEvent.name.trim()) {
		return toolEvent.name.trim();
	}

	if (typeof toolEvent?.tool_name === 'string' && toolEvent.tool_name.trim()) {
		return toolEvent.tool_name.trim();
	}

	return 'Tool activity';
};

const getHermesToolEventPreview = (toolEvent: any) =>
	getFirstNonEmptyLine(
		toToolSummaryText(toolEvent?.preview) ||
			toToolSummaryText(toolEvent?.message) ||
			toToolSummaryText(toolEvent?.command) ||
			toToolSummaryText(toolEvent?.summary) ||
			toToolSummaryText(toolEvent?.output)
	);

const buildSyntheticHermesToolExecutionId = (executions: any[]) =>
	`${LIVE_HERMES_TOOL_EXECUTION_PREFIX}${executions.length + 1}`;

const getNumericPayloadValue = (value: unknown) => {
	if (typeof value === 'number' && Number.isFinite(value)) {
		return value;
	}

	if (typeof value === 'string' && value.trim()) {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : null;
	}

	return null;
};

const getExitCode = (payload: Record<string, unknown>) =>
	getNumericPayloadValue(payload.exit_code ?? payload.exitCode);

const getCountLabel = (count: number, singular: string, plural: string) =>
	`${count} ${count === 1 ? singular : plural}`;

const getCollectionCount = (payload: Record<string, unknown>, key: string) => {
	const totalCount = getNumericPayloadValue(payload.total_count);
	if (totalCount !== null) {
		return totalCount;
	}

	const value = payload[key];
	return Array.isArray(value) ? value.length : null;
};

const getCollectionSummary = (payload: Record<string, unknown>) => {
	for (const [key, singular, plural] of [
		['files', 'file', 'files'],
		['matches', 'match', 'matches']
	]) {
		if (!Object.prototype.hasOwnProperty.call(payload, key)) {
			continue;
		}

		const count = getCollectionCount(payload, key);
		if (count !== null) {
			return getCountLabel(count, singular, plural);
		}
	}

	const resultsCount = getCollectionCount(payload, 'results');
	const query = getFirstNonEmptyLine(toToolSummaryText(payload.query));
	const mode = getFirstNonEmptyLine(toToolSummaryText(payload.mode));

	if (resultsCount !== null) {
		const countLabel = getCountLabel(resultsCount, 'result', 'results');
		if (query) {
			return `query: ${query} (${countLabel})`;
		}
		if (mode) {
			return `mode: ${mode} (${countLabel})`;
		}

		return countLabel;
	}

	if (query) {
		return `query: ${query}`;
	}

	if (mode) {
		return `mode: ${mode}`;
	}

	const totalCount = getNumericPayloadValue(payload.total_count);
	return totalCount !== null ? getCountLabel(totalCount, 'result', 'results') : null;
};

const getHermesImportedToolJsonSummary = (detail: string, fallback: string) => {
	let parsed: unknown;

	try {
		parsed = JSON.parse(detail);
	} catch {
		return null;
	}

	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
		return null;
	}

	const payload = parsed as Record<string, unknown>;
	const hasKnownResultShape = TOOL_RESULT_KEYS.some((key) =>
		Object.prototype.hasOwnProperty.call(payload, key)
	);

	if (!hasKnownResultShape) {
		return null;
	}

	const exitCode = getExitCode(payload);
	const errorSummary = getFirstNonEmptyLine(
		toToolSummaryText(payload.error) || toToolSummaryText(payload.stderr)
	);

	if (errorSummary && (exitCode === null || exitCode !== 0)) {
		return errorSummary;
	}

	for (const key of ['summary', 'message', 'output', 'stdout', 'result', 'content', 'stderr']) {
		const summary = getFirstNonEmptyLine(toToolSummaryText(payload[key]));
		if (summary) {
			return summary;
		}
	}

	const collectionSummary = getCollectionSummary(payload);
	if (collectionSummary) {
		return collectionSummary;
	}

	if (typeof payload.success === 'boolean') {
		return `success: ${payload.success}`;
	}

	if (exitCode !== null && exitCode !== 0) {
		return `exit_code: ${exitCode}`;
	}

	return fallback;
};

export const getHermesVisibleStatusEntries = (message: any): any[] => {
	const statusEntries = getHermesStatusEntries(message);

	if ((message?.code_executions?.length ?? 0) === 0) {
		return statusEntries;
	}

	return statusEntries.filter((entry) => entry?.action !== HERMES_TOOL_STATUS_ACTION);
};

export const normalizeHermesStreamEventName = (eventName: unknown) => {
	const normalized = typeof eventName === 'string' ? eventName.trim().toLowerCase() : '';

	if (!normalized || normalized === 'message') {
		return 'message';
	}

	if (HERMES_APPROVAL_EVENT_ALIASES.has(normalized)) {
		return 'approval';
	}

	if (HERMES_APPROVAL_RESOLVED_EVENT_ALIASES.has(normalized)) {
		return 'approval.resolved';
	}

	if (HERMES_TOOL_EVENT_ALIASES.has(normalized)) {
		return 'tool';
	}

	if (normalized === 'session.compressed') {
		return 'compressed';
	}

	if (normalized === 'session.warning') {
		return 'warning';
	}

	if (normalized === 'done') {
		return 'done';
	}

	if (normalized === 'run.started') {
		return 'run.started';
	}

	if (normalized === 'run.completed') {
		return 'run.completed';
	}

	return normalized;
};

export const getHermesToolExecutionState = (
	toolEvent: any
): 'running' | 'done' | 'failed' => {
	const eventName =
		typeof toolEvent?.event === 'string'
			? toolEvent.event.trim().toLowerCase()
			: typeof toolEvent?.type === 'string'
				? toolEvent.type.trim().toLowerCase()
				: '';

	if (
		toolEvent?.error ||
		eventName === 'tool.error' ||
		eventName === 'tool.failed' ||
		eventName === 'failed' ||
		eventName === 'error'
	) {
		return 'failed';
	}

	if (
		toolEvent?.done === true ||
		toolEvent?.result ||
		eventName === 'tool.finished' ||
		eventName === 'tool.completed' ||
		eventName === 'done' ||
		eventName === 'completed' ||
		eventName === 'finished'
	) {
		return 'done';
	}

	return 'running';
};

export const upsertHermesToolExecution = (executions: any[] | null | undefined, toolEvent: any) => {
	const nextExecutions = Array.isArray(executions) ? [...executions] : [];
	const explicitId =
		typeof toolEvent?.id === 'string' && toolEvent.id.trim() ? toolEvent.id.trim() : null;
	const state = getHermesToolExecutionState(toolEvent);
	const name = getHermesToolEventName(toolEvent);
	const preview = getHermesToolEventPreview(toolEvent);

	let existingIndex = explicitId
		? nextExecutions.findIndex((execution) => execution?.id === explicitId)
		: -1;

	if (existingIndex === -1 && state !== 'running') {
		for (let index = nextExecutions.length - 1; index >= 0; index -= 1) {
			const execution = nextExecutions[index];
			if (execution?.name === name && !execution?.result) {
				existingIndex = index;
				break;
			}
		}
	}

	const baseExecution =
		existingIndex === -1
			? {
					id: explicitId || buildSyntheticHermesToolExecutionId(nextExecutions)
				}
			: { ...nextExecutions[existingIndex] };

	const nextExecution = {
		...baseExecution,
		name,
		preview: preview || baseExecution.preview || '',
		message:
			toToolSummaryText(toolEvent?.message) || toToolSummaryText(baseExecution.message) || '',
		command:
			toToolSummaryText(toolEvent?.command) || toToolSummaryText(baseExecution.command) || '',
		args:
			toolEvent?.args && typeof toolEvent.args === 'object' && !Array.isArray(toolEvent.args)
				? toolEvent.args
				: baseExecution.args,
		event: typeof toolEvent?.event === 'string' ? toolEvent.event : baseExecution.event
	};

	if (state === 'running') {
		nextExecution.result = null;
	} else if (state === 'failed') {
		nextExecution.result = {
			error:
				toToolSummaryText(toolEvent?.error) ||
				preview ||
				nextExecution.message ||
				nextExecution.command ||
				'Tool failed'
		};
	} else {
		const nextResult =
			toolEvent?.result && typeof toolEvent.result === 'object'
				? { ...toolEvent.result }
				: {};

		if (toolEvent?.files && !nextResult.files) {
			nextResult.files = toolEvent.files;
		}

		if (!nextResult.output && !nextResult.message && !nextResult.content) {
			nextResult.output =
				preview || nextExecution.message || nextExecution.command || 'Completed';
		}

		nextExecution.result = nextResult;
	}

	if (existingIndex === -1) {
		nextExecutions.push(nextExecution);
	} else {
		nextExecutions[existingIndex] = nextExecution;
	}

	return nextExecutions;
};

export const isHermesImportedToolMessage = (message: any) =>
	message?.role === 'tool' || message?.sourceRole === 'tool';

export const getHermesImportedToolName = (message: any) => {
	const explicitName = typeof message?.toolName === 'string' ? message.toolName.trim() : '';
	if (explicitName) {
		return explicitName;
	}

	const content = typeof message?.content === 'string' ? message.content.trim() : '';
	const match = content.match(TOOL_PREFIX_PATTERN);

	return match?.[1]?.trim() || 'tool';
};

export const getHermesImportedToolContent = (message: any) => {
	const content = typeof message?.content === 'string' ? message.content.trim() : '';

	if (!content) {
		return '';
	}

	return content.replace(TOOL_PREFIX_PATTERN, '').trim();
};

export const getHermesImportedToolSummary = (
	message: any,
	fallback = 'Completed'
): string => {
	const detail = getHermesImportedToolContent(message);
	if (!detail) {
		return fallback;
	}

	return getHermesImportedToolJsonSummary(detail, fallback) || getFirstNonEmptyLine(detail) || fallback;
};

export const getCurrentBranchLatestAssistantMessageId = (history: {
	currentId?: string | null;
	messages?: Record<string, any>;
}) => {
	const messages = history?.messages ?? {};
	const seen = new Set<string>();
	let messageId = history?.currentId ?? null;

	while (messageId && !seen.has(messageId)) {
		const message = messages[messageId];
		if (!message) {
			break;
		}

		if (message.role === 'assistant') {
			return messageId;
		}

		seen.add(messageId);
		messageId = message.parentId ?? null;
	}

	return null;
};

export const getHermesComposerActivityMessageId = (
	history: {
		currentId?: string | null;
		messages?: Record<string, any>;
	},
	{
		statusUpdatesEnabled = true
	}: {
		statusUpdatesEnabled?: boolean;
	} = {}
) => {
	const messageId = getCurrentBranchLatestAssistantMessageId(history);

	if (!messageId) {
		return null;
	}

	const message = history?.messages?.[messageId];
	const statusEntries = getHermesStatusEntries(message);
	const hasVisibleStatus =
		statusUpdatesEnabled && statusEntries.length > 0 && !(statusEntries.at(-1)?.hidden ?? false);
	const hasToolActivity = (message?.code_executions?.length ?? 0) > 0;

	return hasVisibleStatus || hasToolActivity ? messageId : null;
};
