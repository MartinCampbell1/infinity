import { afterEach, describe, expect, test, vi } from 'vitest';

import {
	createFounderosHostActionRelay,
	createFounderosWorkspaceRelay
} from '$lib/founderos/bridge';

describe('founderos workspace relay', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	const createRelayTarget = () => {
		const listeners = new Map<string, Set<EventListener>>();

		return {
			addEventListener: (name: string, listener: EventListener) => {
				const current = listeners.get(name) ?? new Set<EventListener>();
				current.add(listener);
				listeners.set(name, current);
			},
			removeEventListener: (name: string, listener: EventListener) => {
				listeners.get(name)?.delete(listener);
			},
			dispatchEvent: (event: Event) => {
				listeners.get(event.type)?.forEach((listener) => listener(event));
				return true;
			}
		};
	};

	test('forwards only validated relay events to the matching handlers', () => {
		const target = createRelayTarget();
		const handlers = {
			onToolStarted: vi.fn(),
			onToolCompleted: vi.fn(),
			onApprovalRequested: vi.fn(),
			onFileOpened: vi.fn(),
			onError: vi.fn(),
			onDeepLink: vi.fn(),
			onProducerBatch: vi.fn()
		};

		const cleanup = createFounderosWorkspaceRelay(handlers, target);

		target.dispatchEvent({
			type: 'founderos:tool-started',
			detail: { toolName: 'planner', eventId: 'evt-1' }
		} as unknown as Event);
		target.dispatchEvent({
			type: 'founderos:tool-completed',
			detail: { toolName: 'planner', eventId: 'evt-1', status: 'completed' }
		} as unknown as Event);
		target.dispatchEvent({
			type: 'founderos:approval-requested',
			detail: { approvalId: 'appr-1', summary: 'Review required' }
		} as unknown as Event);
		target.dispatchEvent({
			type: 'founderos:file-opened',
			detail: { path: '/workspace/src/app.ts' }
		} as unknown as Event);
		target.dispatchEvent({
			type: 'founderos:error',
			detail: { code: 'E42', message: 'Tool failed' }
		} as unknown as Event);
		target.dispatchEvent({
			type: 'founderos:deep-link',
			detail: { sessionId: 'session-1', filePath: '/workspace/src/app.ts', anchor: 'L10' }
		} as unknown as Event);
		target.dispatchEvent({
			type: 'founderos:tool-started',
			detail: { toolName: '', eventId: 'evt-ignored' }
		} as unknown as Event);

		expect(handlers.onToolStarted).toHaveBeenCalledTimes(1);
		expect(handlers.onToolStarted).toHaveBeenCalledWith({ toolName: 'planner', eventId: 'evt-1' });
		expect(handlers.onToolCompleted).toHaveBeenCalledWith({
			toolName: 'planner',
			eventId: 'evt-1',
			status: 'completed'
		});
		expect(handlers.onApprovalRequested).toHaveBeenCalledWith({
			approvalId: 'appr-1',
			summary: 'Review required'
		});
		expect(handlers.onFileOpened).toHaveBeenCalledWith({ path: '/workspace/src/app.ts' });
		expect(handlers.onError).toHaveBeenCalledWith({ code: 'E42', message: 'Tool failed' });
		expect(handlers.onDeepLink).toHaveBeenCalledWith({
			sessionId: 'session-1',
			filePath: '/workspace/src/app.ts',
			anchor: 'L10'
		});

		cleanup();
	});

	test('forwards validated producer batches without fanning them into legacy handlers', () => {
		const target = createRelayTarget();
		const handlers = {
			onToolStarted: vi.fn(),
			onToolCompleted: vi.fn(),
			onApprovalRequested: vi.fn(),
			onFileOpened: vi.fn(),
			onError: vi.fn(),
			onDeepLink: vi.fn(),
			onProducerBatch: vi.fn()
		};

		const cleanup = createFounderosWorkspaceRelay(handlers, target);

		target.dispatchEvent({
			type: 'founderos:producer-batch',
			detail: {
				producer: 'workspace_runtime_bridge',
				messages: [
					{
						type: 'workspace.tool.started',
						payload: { toolName: 'planner', eventId: 'evt-1' }
					},
					{
						type: 'workspace.tool.completed',
						payload: { toolName: 'planner', eventId: 'evt-1', status: 'completed' }
					},
					{
						type: 'workspace.file.opened',
						payload: { path: '/workspace/src/app.ts' }
					},
					{
						type: 'workspace.deepLink',
						payload: { sessionId: 'session-1', filePath: '/workspace/src/app.ts', anchor: 'L10' }
					},
					{
						type: 'workspace.error',
						payload: { message: 'Batch failure' }
					},
					{
						type: 'workspace.approval.requested',
						payload: { approvalId: 'appr-1', summary: 'Review required' }
					},
					{
						type: 'workspace.tool.started',
						payload: { toolName: '', eventId: 'ignored' }
					}
				]
			}
		} as unknown as Event);

		expect(handlers.onProducerBatch).toHaveBeenCalledTimes(1);
		expect(handlers.onProducerBatch).toHaveBeenCalledWith({
			producer: 'workspace_runtime_bridge',
			messages: [
				{
					type: 'workspace.tool.started',
					payload: { toolName: 'planner', eventId: 'evt-1' }
				},
				{
					type: 'workspace.tool.completed',
					payload: { toolName: 'planner', eventId: 'evt-1', status: 'completed' }
				},
				{
					type: 'workspace.file.opened',
					payload: { path: '/workspace/src/app.ts' }
				},
				{
					type: 'workspace.deepLink',
					payload: { sessionId: 'session-1', filePath: '/workspace/src/app.ts', anchor: 'L10' }
				},
				{
					type: 'workspace.error',
					payload: { message: 'Batch failure' }
				},
				{
					type: 'workspace.approval.requested',
					payload: { approvalId: 'appr-1', summary: 'Review required' }
				}
			]
		});
		expect(handlers.onToolStarted).not.toHaveBeenCalled();
		expect(handlers.onToolCompleted).not.toHaveBeenCalled();
		expect(handlers.onFileOpened).not.toHaveBeenCalled();
		expect(handlers.onDeepLink).not.toHaveBeenCalled();
		expect(handlers.onError).not.toHaveBeenCalled();
		expect(handlers.onApprovalRequested).not.toHaveBeenCalled();

		cleanup();
	});

	test('detaches listeners on cleanup', () => {
		const target = createRelayTarget();
		const handlers = {
			onToolStarted: vi.fn(),
			onToolCompleted: vi.fn(),
			onApprovalRequested: vi.fn(),
			onFileOpened: vi.fn(),
			onError: vi.fn(),
			onDeepLink: vi.fn(),
			onProducerBatch: vi.fn()
		};

		const cleanup = createFounderosWorkspaceRelay(handlers, target);
		cleanup();

		target.dispatchEvent({
			type: 'founderos:file-opened',
			detail: { path: '/workspace/src/after-cleanup.ts' }
		} as unknown as Event);

		expect(handlers.onFileOpened).not.toHaveBeenCalled();
	});

	test('forwards validated host actions and detaches listeners on cleanup', () => {
		const target = createRelayTarget();
		const handlers = {
			onAccountSwitch: vi.fn(),
			onSessionRetry: vi.fn(),
			onSessionFocus: vi.fn()
		};

		const cleanup = createFounderosHostActionRelay(handlers, target);

		target.dispatchEvent({
			type: 'founderos.account.switch',
			detail: { accountId: 'acct-1' }
		} as unknown as Event);
		target.dispatchEvent({
			type: 'founderos.session.retry',
			detail: { retryMode: 'fallback_account' }
		} as unknown as Event);
		target.dispatchEvent({
			type: 'founderos.session.focus',
			detail: { section: 'approvals' }
		} as unknown as Event);
		target.dispatchEvent({
			type: 'founderos.session.retry',
			detail: { retryMode: 'not-valid' }
		} as unknown as Event);

		expect(handlers.onAccountSwitch).toHaveBeenCalledWith({ accountId: 'acct-1' });
		expect(handlers.onSessionRetry).toHaveBeenCalledWith({ retryMode: 'fallback_account' });
		expect(handlers.onSessionFocus).toHaveBeenCalledWith({ section: 'approvals' });
		expect(handlers.onSessionRetry).toHaveBeenCalledTimes(1);

		cleanup();

		target.dispatchEvent({
			type: 'founderos.account.switch',
			detail: { accountId: 'acct-2' }
		} as unknown as Event);

		expect(handlers.onAccountSwitch).toHaveBeenCalledTimes(1);
	});
});
