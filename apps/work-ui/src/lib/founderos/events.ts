import { get } from 'svelte/store';

import { founderosLaunchContext } from '$lib/founderos';
import { founderosHostContext } from '$lib/founderos/bridge';
import type {
	WorkspaceRuntimeBridgeWorkspaceMessage,
	WorkspaceRuntimeProducerBatchMessage
} from '$lib/founderos/types';

const isBrowser = () => typeof window !== 'undefined' && typeof window.dispatchEvent === 'function';

const normalizeText = (value: unknown) =>
	typeof value === 'string' ? value.trim() : '';

const dispatchFounderosEvent = <T extends Record<string, unknown>>(
	type: string,
	payload: T
) => {
	if (!isBrowser()) {
		return false;
	}

	window.dispatchEvent(new CustomEvent(type, { detail: payload }));
	return true;
};

type FounderosProducerBatchPayload = WorkspaceRuntimeProducerBatchMessage['payload'];

const normalizeProducerMessage = (
	message: WorkspaceRuntimeBridgeWorkspaceMessage
): WorkspaceRuntimeBridgeWorkspaceMessage | null => {
	switch (message.type) {
		case 'workspace.ready':
			return message;
		case 'workspace.session.updated': {
			const title = normalizeText(message.payload.title);
			const status = normalizeText(message.payload.status);
			if (!title && !status) {
				return null;
			}
			return {
				type: 'workspace.session.updated',
				payload: {
					title: title || undefined,
					status: status || undefined
				}
			};
		}
		case 'workspace.tool.started': {
			const toolName = normalizeText(message.payload.toolName);
			const eventId = normalizeText(message.payload.eventId);
			return toolName && eventId
				? {
						type: 'workspace.tool.started',
						payload: { toolName, eventId }
					}
				: null;
		}
		case 'workspace.tool.completed': {
			const toolName = normalizeText(message.payload.toolName);
			const eventId = normalizeText(message.payload.eventId);
			return toolName &&
				eventId &&
				(message.payload.status === 'completed' || message.payload.status === 'failed')
				? {
						type: 'workspace.tool.completed',
						payload: { toolName, eventId, status: message.payload.status }
					}
				: null;
		}
		case 'workspace.approval.requested': {
			const approvalId = normalizeText(message.payload.approvalId);
			const summary = normalizeText(message.payload.summary);
			return approvalId && summary
				? {
						type: 'workspace.approval.requested',
						payload: { approvalId, summary }
					}
				: null;
		}
		case 'workspace.file.opened': {
			const path = normalizeText(message.payload.path);
			return path
				? {
						type: 'workspace.file.opened',
						payload: { path }
					}
				: null;
		}
		case 'workspace.error': {
			const messageText = normalizeText(message.payload.message);
			if (!messageText) {
				return null;
			}

			const code = normalizeText(message.payload.code);
			return {
				type: 'workspace.error',
				payload: code ? { code, message: messageText } : { message: messageText }
			};
		}
		case 'workspace.deepLink': {
			const sessionId = getFounderosSessionId(message.payload.sessionId);
			if (!sessionId) {
				return null;
			}

			const filePath = normalizeText(message.payload.filePath);
			const anchor = normalizeText(message.payload.anchor);
			return {
				type: 'workspace.deepLink',
				payload: {
					sessionId,
					filePath: filePath || undefined,
					anchor: anchor || undefined
				}
			};
		}
	}
};

const getFounderosSessionId = (explicitSessionId?: string) => {
	const normalizedExplicit = normalizeText(explicitSessionId);
	if (normalizedExplicit) {
		return normalizedExplicit;
	}

	const hostSessionId = normalizeText(get(founderosHostContext)?.sessionId);
	if (hostSessionId) {
		return hostSessionId;
	}

	try {
		return normalizeText(get(founderosLaunchContext)?.sessionId);
	} catch {
		return '';
	}
};

export const emitFounderosToolStarted = (payload: {
	toolName: string;
	eventId: string;
}) => {
	const toolName = normalizeText(payload.toolName);
	const eventId = normalizeText(payload.eventId);

	if (!toolName || !eventId) {
		return false;
	}

	const accepted = dispatchFounderosEvent('founderos:tool-started', {
		toolName,
		eventId
	});
	emitFounderosProducerBatch({
		messages: [{ type: 'workspace.tool.started', payload: { toolName, eventId } }]
	});
	return accepted;
};

export const emitFounderosToolCompleted = (payload: {
	toolName: string;
	eventId: string;
	status: 'completed' | 'failed';
}) => {
	const toolName = normalizeText(payload.toolName);
	const eventId = normalizeText(payload.eventId);

	if (!toolName || !eventId || (payload.status !== 'completed' && payload.status !== 'failed')) {
		return false;
	}

	const accepted = dispatchFounderosEvent('founderos:tool-completed', {
		toolName,
		eventId,
		status: payload.status
	});
	emitFounderosProducerBatch({
		messages: [
			{
				type: 'workspace.tool.completed',
				payload: { toolName, eventId, status: payload.status }
			}
		]
	});
	return accepted;
};

export const emitFounderosApprovalRequested = (payload: {
	approvalId: string;
	summary: string;
}) => {
	const approvalId = normalizeText(payload.approvalId);
	const summary = normalizeText(payload.summary);

	if (!approvalId || !summary) {
		return false;
	}

	const accepted = dispatchFounderosEvent('founderos:approval-requested', {
		approvalId,
		summary
	});
	emitFounderosProducerBatch({
		messages: [{ type: 'workspace.approval.requested', payload: { approvalId, summary } }]
	});
	return accepted;
};

export const emitFounderosError = (payload: { code?: string; message: string }) => {
	const message = normalizeText(payload.message);
	if (!message) {
		return false;
	}

	const detail: { code?: string; message: string } = { message };
	const code = normalizeText(payload.code);
	if (code) {
		detail.code = code;
	}

	const accepted = dispatchFounderosEvent('founderos:error', detail);
	emitFounderosProducerBatch({
		messages: [{ type: 'workspace.error', payload: detail }]
	});
	return accepted;
};

export const emitFounderosFileOpened = (payload: { path: string }) => {
	const path = normalizeText(payload.path);
	if (!path) {
		return false;
	}

	const accepted = dispatchFounderosEvent('founderos:file-opened', { path });
	emitFounderosProducerBatch({
		messages: [{ type: 'workspace.file.opened', payload: { path } }]
	});
	return accepted;
};

export const emitFounderosDeepLink = (payload: {
	sessionId?: string;
	filePath?: string;
	anchor?: string;
}) => {
	const sessionId = getFounderosSessionId(payload.sessionId);
	if (!sessionId) {
		return false;
	}

	const filePath = normalizeText(payload.filePath);
	const anchor = normalizeText(payload.anchor);
	const detail: { sessionId: string; filePath?: string; anchor?: string } = { sessionId };

	if (filePath) {
		detail.filePath = filePath;
	}

	if (anchor) {
		detail.anchor = anchor;
	}

	const accepted = dispatchFounderosEvent('founderos:deep-link', detail);
	emitFounderosProducerBatch({
		messages: [{ type: 'workspace.deepLink', payload: detail }]
	});
	return accepted;
};

export const emitFounderosProducerBatch = (payload: {
	messages: WorkspaceRuntimeBridgeWorkspaceMessage[];
}) => {
	const messages = Array.isArray(payload.messages)
		? payload.messages
				.map((message) => normalizeProducerMessage(message))
				.filter((message): message is WorkspaceRuntimeBridgeWorkspaceMessage => message !== null)
		: [];

	if (messages.length === 0) {
		return false;
	}

	const detail: FounderosProducerBatchPayload = {
		producer: 'workspace_runtime_bridge',
		messages
	};

	return dispatchFounderosEvent('founderos:producer-batch', detail);
};
