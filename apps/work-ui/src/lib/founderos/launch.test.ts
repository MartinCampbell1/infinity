import { describe, expect, test, vi } from 'vitest';

import {
	resolveFounderosLaunchVerificationUrl,
	verifyFounderosLaunchIntegrity
} from '$lib/founderos/launch';
import type { FounderosLaunchContext } from '$lib/founderos';

const launchContext = (overrides: Partial<FounderosLaunchContext> = {}): FounderosLaunchContext => ({
	enabled: true,
	embedded: true,
	projectId: 'project-atlas',
	sessionId: 'session-2026-04-11-001',
	groupId: 'group-ops-01',
	accountId: 'account-chatgpt-01',
	workspaceId: 'workspace-atlas-main',
	launchToken: 'signed-token',
	hostOrigin: 'http://127.0.0.1:3737',
	rawParams: {
		founderos_launch: '1',
		project_id: 'project-atlas',
		session_id: 'session-2026-04-11-001',
		opened_from: 'execution_board'
	},
	launchSource: 'founderos_embedded',
	...overrides
});

describe('founderos launch verification', () => {
	test('resolves the shell verification endpoint from host origin and sessionId', () => {
		expect(resolveFounderosLaunchVerificationUrl(launchContext())).toBe(
			'http://127.0.0.1:3737/api/control/execution/workspace/session-2026-04-11-001/launch-token'
		);
		expect(resolveFounderosLaunchVerificationUrl(launchContext({ hostOrigin: null }))).toBe(null);
	});

	test('fails fast when required launch verification fields are missing', async () => {
		await expect(
			verifyFounderosLaunchIntegrity(launchContext({ launchToken: null }), vi.fn() as typeof fetch)
		).resolves.toEqual({
			valid: false,
			state: 'missing',
			note: 'FounderOS launch verification requires projectId and launchToken.'
		});
	});

	test('accepts a valid shell verification response', async () => {
		const fetchImpl = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				accepted: true,
				state: 'valid',
				note: 'Shell-issued workspace launch token is valid.'
			})
		});

		const result = await verifyFounderosLaunchIntegrity(launchContext(), fetchImpl as typeof fetch);

		expect(fetchImpl).toHaveBeenCalledTimes(1);
		expect(result).toEqual({
			valid: true,
			state: 'valid',
			note: 'Shell-issued workspace launch token is valid.'
		});
	});

	test('surfaces expired verification responses without treating them as auth', async () => {
		const fetchImpl = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				accepted: false,
				state: 'expired',
				note: 'Workspace launch token has expired and must be reissued by the shell.'
			})
		});

		const result = await verifyFounderosLaunchIntegrity(launchContext(), fetchImpl as typeof fetch);

		expect(result.valid).toBe(false);
		expect(result.state).toBe('expired');
	});
});

