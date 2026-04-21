import { afterEach, describe, expect, test, vi } from 'vitest';

import {
	emitFounderosApprovalRequested,
	emitFounderosDeepLink,
	emitFounderosError,
	emitFounderosFileOpened,
	emitFounderosProducerBatch,
	emitFounderosToolCompleted,
	emitFounderosToolStarted
} from '$lib/founderos/events';

class FakeCustomEvent<T = unknown> extends Event {
	detail: T;

	constructor(type: string, init?: CustomEventInit<T>) {
		super(type);
		this.detail = init?.detail as T;
	}
}

describe('founderos browser event emitters', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	test('dispatches validated workspace lifecycle events to window', () => {
		const dispatchEvent = vi.fn(() => true);
		vi.stubGlobal('window', { dispatchEvent });
		vi.stubGlobal('CustomEvent', FakeCustomEvent);

		expect(emitFounderosToolStarted({ toolName: 'planner', eventId: 'evt-1' })).toBe(true);
		expect(
			emitFounderosToolCompleted({
				toolName: 'planner',
				eventId: 'evt-1',
				status: 'completed'
			})
		).toBe(true);
		expect(
			emitFounderosApprovalRequested({
				approvalId: 'approval-1',
				summary: 'Review command execution'
			})
		).toBe(true);
		expect(emitFounderosFileOpened({ path: '/workspace/src/app.ts' })).toBe(true);
		expect(
			emitFounderosError({
				code: 'tool.failed',
				message: 'Planner command failed'
			})
		).toBe(true);
		expect(
			emitFounderosDeepLink({
				sessionId: 'session-1',
				filePath: '/workspace/src/app.ts',
				anchor: 'diff'
			})
		).toBe(true);

		expect(dispatchEvent).toHaveBeenCalledTimes(12);
		const calls = dispatchEvent.mock.calls as unknown as Array<[Event]>;
		const firstEvent = calls[0]?.[0];
		const secondEvent = calls[1]?.[0];
		const lastEvent = calls[11]?.[0];

		expect(firstEvent).toMatchObject({
			type: 'founderos:tool-started',
			detail: { toolName: 'planner', eventId: 'evt-1' }
		});
		expect(secondEvent).toMatchObject({
			type: 'founderos:producer-batch',
			detail: {
				producer: 'workspace_runtime_bridge',
				messages: [{ type: 'workspace.tool.started', payload: { toolName: 'planner', eventId: 'evt-1' } }]
			}
		});
		expect(lastEvent).toMatchObject({
			type: 'founderos:producer-batch',
			detail: {
				producer: 'workspace_runtime_bridge',
				messages: [
					{
						type: 'workspace.deepLink',
						payload: {
							sessionId: 'session-1',
							filePath: '/workspace/src/app.ts',
							anchor: 'diff'
						}
					}
				]
			}
		});
	});

	test('rejects malformed payloads and skips deep-link dispatch without session id', () => {
		const dispatchEvent = vi.fn(() => true);
		vi.stubGlobal('window', { dispatchEvent });
		vi.stubGlobal('CustomEvent', FakeCustomEvent);

		expect(emitFounderosToolStarted({ toolName: '', eventId: 'evt-1' })).toBe(false);
		expect(
			emitFounderosToolCompleted({
				toolName: 'planner',
				eventId: 'evt-1',
				status: 'unknown' as 'completed'
			})
		).toBe(false);
		expect(emitFounderosApprovalRequested({ approvalId: '', summary: 'x' })).toBe(false);
		expect(emitFounderosFileOpened({ path: '   ' })).toBe(false);
		expect(emitFounderosError({ message: '   ' })).toBe(false);
		expect(emitFounderosDeepLink({ filePath: '/workspace/src/app.ts' })).toBe(false);

		expect(dispatchEvent).not.toHaveBeenCalled();
	});

	test('dispatches normalized producer batches as a single custom event', () => {
		const dispatchEvent = vi.fn(() => true);
		vi.stubGlobal('window', { dispatchEvent });
		vi.stubGlobal('CustomEvent', FakeCustomEvent);

		expect(
			emitFounderosProducerBatch({
				messages: [
					{
						type: 'workspace.tool.started',
						payload: { toolName: ' planner ', eventId: ' evt-1 ' }
					},
					{
						type: 'workspace.file.opened',
						payload: { path: ' /workspace/src/app.ts ' }
					},
					{
						type: 'workspace.deepLink',
						payload: { sessionId: ' session-1 ', filePath: ' /workspace/src/app.ts ' }
					},
					{
						type: 'workspace.error',
						payload: { message: '   ' }
					}
				]
			})
		).toBe(true);

		expect(dispatchEvent).toHaveBeenCalledTimes(1);
		const firstCall = dispatchEvent.mock.calls[0] as unknown as [Event] | undefined;
		expect(firstCall?.[0]).toMatchObject({
			type: 'founderos:producer-batch',
			detail: {
				producer: 'workspace_runtime_bridge',
				messages: [
					{
						type: 'workspace.tool.started',
						payload: { toolName: 'planner', eventId: 'evt-1' }
					},
					{
						type: 'workspace.file.opened',
						payload: { path: '/workspace/src/app.ts' }
					},
					{
						type: 'workspace.deepLink',
						payload: { sessionId: 'session-1', filePath: '/workspace/src/app.ts' }
					}
				]
			}
		});
	});
});
