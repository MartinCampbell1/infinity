import { get, writable, type Readable } from 'svelte/store';

import type { FounderosLaunchContext } from '$lib/founderos';
import {
	isHostToWorkspaceMessage,
	isSessionWorkspaceHostContextPatch
} from '$lib/founderos/contract';
import type {
	HostToWorkspaceMessage,
	SessionWorkspaceHostContext,
	WorkspaceRuntimeProducerBatchMessage,
	WorkspaceRuntimeBridgeWorkspaceMessage,
	WorkspaceToHostMessage
} from '$lib/founderos/types';

type FounderosWorkspaceRelayHandlers = {
	onToolStarted: (payload: { toolName: string; eventId: string }) => void;
	onToolCompleted: (payload: {
		toolName: string;
		eventId: string;
		status: 'completed' | 'failed';
	}) => void;
	onApprovalRequested: (payload: { approvalId: string; summary: string }) => void;
	onFileOpened: (payload: { path: string }) => void;
	onError: (payload: { code?: string; message: string }) => void;
	onDeepLink: (payload: { sessionId: string; filePath?: string; anchor?: string }) => void;
	onProducerBatch: (payload: WorkspaceRuntimeProducerBatchMessage['payload']) => void;
};

type FounderosWorkspaceRelayTarget = Pick<Window, 'addEventListener' | 'removeEventListener'>;
type FounderosHostActionRelayHandlers = {
	onAccountSwitch: (payload: { accountId: string }) => void;
	onSessionRetry: (payload: { retryMode: 'same_account' | 'fallback_account' }) => void;
	onSessionFocus: (payload: { section: 'chat' | 'files' | 'approvals' | 'diff' }) => void;
};

const hostContextStore = writable<SessionWorkspaceHostContext | null>(null);
const readyStore = writable(false);

export const founderosHostContext: Readable<SessionWorkspaceHostContext | null> = hostContextStore;
export const founderosBridgeReady: Readable<boolean> = readyStore;

let launchContext: FounderosLaunchContext | null = null;
let bridgeCleanup: (() => void) | null = null;
let readySent = false;

const isBrowser = () => typeof window !== 'undefined';
const hasHostParent = () => isBrowser() && window.parent && window.parent !== window;

const canUsePostMessage = () => {
	if (!launchContext?.enabled || !hasHostParent()) {
		return false;
	}

	// In embedded mode, require explicit host origin to avoid wildcard postMessage.
	if (launchContext.embedded && !launchContext.hostOrigin) {
		return false;
	}

	return true;
};

const messageTargetOrigin = () => launchContext?.hostOrigin ?? '*';

const isTrustedHostMessage = (event: MessageEvent<unknown>) => {
	if (!hasHostParent() || event.source !== window.parent) {
		return false;
	}

	const expectedOrigin = launchContext?.hostOrigin;
	if (!expectedOrigin) {
		return launchContext?.embedded ? false : true;
	}

	return event.origin === expectedOrigin;
};

const postToHost = (message: WorkspaceToHostMessage) => {
	if (!canUsePostMessage()) {
		return;
	}
	window.parent.postMessage(message, messageTargetOrigin());
};

const mergeContext = (base: SessionWorkspaceHostContext, patch: Partial<SessionWorkspaceHostContext>) => ({
	...base,
	...patch,
	quotaState: patch.quotaState ? { ...base.quotaState, ...patch.quotaState } : base.quotaState
});

export const applyFounderosHostContextPatch = (patch: Partial<SessionWorkspaceHostContext>) => {
	const existing = get(hostContextStore);
	if (!existing) {
		return;
	}

	hostContextStore.set(mergeContext(existing, patch));
};

export const seedFounderosHostContext = (context: SessionWorkspaceHostContext | null) => {
	hostContextStore.set(context);
};

const readCustomEventDetail = <T extends Record<string, unknown>>(event: Event) => {
	const detail = (event as CustomEvent).detail;
	return detail && typeof detail === 'object' ? (detail as T) : null;
};

const isNonEmptyString = (value: unknown): value is string =>
	typeof value === 'string' && value.trim().length > 0;

const isWorkspaceRuntimeBridgeWorkspaceMessage = (
	value: unknown
): value is WorkspaceRuntimeBridgeWorkspaceMessage => {
	if (typeof value !== 'object' || value === null) {
		return false;
	}

	const message = value as Record<string, unknown>;
	switch (message.type) {
		case 'workspace.ready':
			return true;
		case 'workspace.session.updated': {
			if (typeof message.payload !== 'object' || message.payload === null) {
				return false;
			}
			const payload = message.payload as Record<string, unknown>;
			return (
				(payload.title === undefined || typeof payload.title === 'string') &&
				(payload.status === undefined || typeof payload.status === 'string') &&
				(isNonEmptyString(payload.title) || isNonEmptyString(payload.status))
			);
		}
		case 'workspace.tool.started':
			return (
				typeof message.payload === 'object' &&
				message.payload !== null &&
				isNonEmptyString((message.payload as Record<string, unknown>).toolName) &&
				isNonEmptyString((message.payload as Record<string, unknown>).eventId)
			);
		case 'workspace.tool.completed':
			return (
				typeof message.payload === 'object' &&
				message.payload !== null &&
				isNonEmptyString((message.payload as Record<string, unknown>).toolName) &&
				isNonEmptyString((message.payload as Record<string, unknown>).eventId) &&
				((message.payload as Record<string, unknown>).status === 'completed' ||
					(message.payload as Record<string, unknown>).status === 'failed')
			);
		case 'workspace.approval.requested':
			return (
				typeof message.payload === 'object' &&
				message.payload !== null &&
				isNonEmptyString((message.payload as Record<string, unknown>).approvalId) &&
				isNonEmptyString((message.payload as Record<string, unknown>).summary)
			);
		case 'workspace.file.opened':
			return (
				typeof message.payload === 'object' &&
				message.payload !== null &&
				isNonEmptyString((message.payload as Record<string, unknown>).path)
			);
		case 'workspace.error':
			return (
				typeof message.payload === 'object' &&
				message.payload !== null &&
				isNonEmptyString((message.payload as Record<string, unknown>).message)
			);
		case 'workspace.deepLink':
			return (
				typeof message.payload === 'object' &&
				message.payload !== null &&
				isNonEmptyString((message.payload as Record<string, unknown>).sessionId)
			);
		default:
			return false;
	}
};

const isRetryMode = (value: unknown): value is 'same_account' | 'fallback_account' =>
	value === 'same_account' || value === 'fallback_account';

const isFocusSection = (value: unknown): value is 'chat' | 'files' | 'approvals' | 'diff' =>
	value === 'chat' || value === 'files' || value === 'approvals' || value === 'diff';

export const createFounderosWorkspaceRelay = (
	handlers: FounderosWorkspaceRelayHandlers,
	target: FounderosWorkspaceRelayTarget | null = isBrowser() ? window : null
) => {
	if (!target) {
		return () => {};
	}

	const listeners: Array<[string, EventListener]> = [
		[
			'founderos:tool-started',
			(event: Event) => {
				const detail = readCustomEventDetail<{ toolName: string; eventId: string }>(event);
				if (detail?.toolName && detail?.eventId) {
					handlers.onToolStarted(detail);
				}
			}
		],
		[
			'founderos:tool-completed',
			(event: Event) => {
				const detail = readCustomEventDetail<{
					toolName: string;
					eventId: string;
					status: 'completed' | 'failed';
				}>(event);
				if (detail?.toolName && detail?.eventId && detail?.status) {
					handlers.onToolCompleted(detail);
				}
			}
		],
		[
			'founderos:approval-requested',
			(event: Event) => {
				const detail = readCustomEventDetail<{ approvalId: string; summary: string }>(event);
				if (detail?.approvalId && detail?.summary) {
					handlers.onApprovalRequested(detail);
				}
			}
		],
		[
			'founderos:file-opened',
			(event: Event) => {
				const detail = readCustomEventDetail<{ path: string }>(event);
				if (detail?.path) {
					handlers.onFileOpened(detail);
				}
			}
		],
		[
			'founderos:error',
			(event: Event) => {
				const detail = readCustomEventDetail<{ code?: string; message: string }>(event);
				if (detail?.message) {
					handlers.onError(detail);
				}
			}
		],
		[
			'founderos:deep-link',
			(event: Event) => {
				const detail = readCustomEventDetail<{ sessionId: string; filePath?: string; anchor?: string }>(
					event
				);
				if (detail?.sessionId) {
					handlers.onDeepLink(detail);
				}
			}
		],
		[
			'founderos:producer-batch',
			(event: Event) => {
				const detail = readCustomEventDetail<WorkspaceRuntimeProducerBatchMessage['payload']>(event);
				if (
					detail?.producer !== 'workspace_runtime_bridge' ||
					!Array.isArray(detail.messages) ||
					detail.messages.length === 0
				) {
					return;
				}

				const messages = detail.messages.filter((message) =>
					isWorkspaceRuntimeBridgeWorkspaceMessage(message)
				);
				if (messages.length === 0) {
					return;
				}

				handlers.onProducerBatch({
					producer: 'workspace_runtime_bridge',
					messages
				});
			}
		]
	];

	listeners.forEach(([eventName, listener]) => {
		target.addEventListener(eventName, listener);
	});

	return () => {
		listeners.forEach(([eventName, listener]) => {
			target.removeEventListener(eventName, listener);
		});
	};
};

export const createFounderosHostActionRelay = (
	handlers: FounderosHostActionRelayHandlers,
	target: FounderosWorkspaceRelayTarget | null = isBrowser() ? window : null
) => {
	if (!target) {
		return () => {};
	}

	const listeners: Array<[string, EventListener]> = [
		[
			'founderos.account.switch',
			(event: Event) => {
				const detail = readCustomEventDetail<{ accountId: string }>(event);
				if (typeof detail?.accountId === 'string' && detail.accountId.trim()) {
					handlers.onAccountSwitch({ accountId: detail.accountId.trim() });
				}
			}
		],
		[
			'founderos.session.retry',
			(event: Event) => {
				const detail = readCustomEventDetail<{ retryMode: 'same_account' | 'fallback_account' }>(
					event
				);
				if (isRetryMode(detail?.retryMode)) {
					handlers.onSessionRetry({ retryMode: detail.retryMode });
				}
			}
		],
		[
			'founderos.session.focus',
			(event: Event) => {
				const detail = readCustomEventDetail<{ section: 'chat' | 'files' | 'approvals' | 'diff' }>(
					event
				);
				if (isFocusSection(detail?.section)) {
					handlers.onSessionFocus({ section: detail.section });
				}
			}
		]
	];

	listeners.forEach(([eventName, listener]) => {
		target.addEventListener(eventName, listener);
	});

	return () => {
		listeners.forEach(([eventName, listener]) => {
			target.removeEventListener(eventName, listener);
		});
	};
};

const handleHostMessage = (message: HostToWorkspaceMessage) => {
	switch (message.type) {
		case 'founderos.bootstrap':
			hostContextStore.set(message.payload);
			return;
		case 'founderos.session.meta': {
			if (!isSessionWorkspaceHostContextPatch(message.payload)) {
				return;
			}
			const existing = get(hostContextStore);
			if (existing) {
				hostContextStore.set(mergeContext(existing, message.payload));
			}
			return;
		}
		case 'founderos.account.switch':
			applyFounderosHostContextPatch({
				accountId: message.payload.accountId,
				accountLabel: null
			});
			if (!isBrowser()) {
				return;
			}
			window.dispatchEvent(new CustomEvent(message.type, { detail: message.payload }));
			return;
		case 'founderos.session.retry':
		case 'founderos.session.focus':
			if (!isBrowser()) {
				return;
			}
			window.dispatchEvent(new CustomEvent(message.type, { detail: message.payload }));
			return;
	}
};

export const syncFounderosLaunchContext = (context: FounderosLaunchContext) => {
	launchContext = context;
};

const emitReadyToHost = () => {
	if (readySent) {
		return;
	}

	postToHost({ type: 'workspace.ready' });
	readySent = true;
};

export const initFounderosBridge = (context: FounderosLaunchContext) => {
	syncFounderosLaunchContext(context);

	if (!isBrowser() || !context.enabled || !hasHostParent()) {
		readyStore.set(false);
		hostContextStore.set(null);
		readySent = false;
		return () => undefined;
	}

	if (context.embedded && !context.hostOrigin) {
		readyStore.set(false);
		hostContextStore.set(null);
		readySent = false;
		return () => undefined;
	}

	if (bridgeCleanup) {
		bridgeCleanup();
		bridgeCleanup = null;
	}

	const onWindowMessage = (event: MessageEvent<unknown>) => {
		if (!isTrustedHostMessage(event)) {
			return;
		}
		if (!isHostToWorkspaceMessage(event.data)) {
			return;
		}
		handleHostMessage(event.data);
	};

	window.addEventListener('message', onWindowMessage);
	readyStore.set(true);
	readySent = false;
	emitReadyToHost();

	bridgeCleanup = () => {
		window.removeEventListener('message', onWindowMessage);
		readyStore.set(false);
		readySent = false;
	};

	return bridgeCleanup;
};

export const teardownFounderosBridge = () => {
	if (bridgeCleanup) {
		bridgeCleanup();
		bridgeCleanup = null;
	}
	readyStore.set(false);
	hostContextStore.set(null);
	readySent = false;
};

export const emitWorkspaceSessionUpdated = (payload: { title?: string; status?: string }) => {
	postToHost({ type: 'workspace.session.updated', payload });
};

export const emitWorkspaceToolStarted = (payload: { toolName: string; eventId: string }) => {
	postToHost({ type: 'workspace.tool.started', payload });
};

export const emitWorkspaceToolCompleted = (payload: {
	toolName: string;
	eventId: string;
	status: 'completed' | 'failed';
}) => {
	postToHost({ type: 'workspace.tool.completed', payload });
};

export const emitWorkspaceApprovalRequested = (payload: { approvalId: string; summary: string }) => {
	postToHost({ type: 'workspace.approval.requested', payload });
};

export const emitWorkspaceFileOpened = (payload: { path: string }) => {
	postToHost({ type: 'workspace.file.opened', payload });
};

export const emitWorkspaceError = (payload: { code?: string; message: string }) => {
	postToHost({ type: 'workspace.error', payload });
};

export const emitWorkspaceDeepLink = (payload: {
	sessionId: string;
	filePath?: string;
	anchor?: string;
}) => {
	postToHost({ type: 'workspace.deepLink', payload });
};

export const emitWorkspaceProducerBatch = (
	payload: WorkspaceRuntimeProducerBatchMessage['payload']
) => {
	postToHost({ type: 'workspace.producer.batch', payload });
};
