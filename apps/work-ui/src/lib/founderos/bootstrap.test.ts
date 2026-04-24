import { describe, expect, test, vi } from 'vitest';

import type { FounderosLaunchContext } from '$lib/founderos';
import {
	exchangeFounderosLaunchSession,
	fetchFounderosLaunchBootstrap,
	resolveFounderosLaunchBootstrapUrl,
	resolveFounderosLaunchSessionUrl
} from '$lib/founderos/bootstrap';

const launchContext = (
	overrides: Partial<FounderosLaunchContext> = {}
): FounderosLaunchContext => ({
	enabled: true,
	embedded: true,
	projectId: 'project-atlas',
	sessionId: 'session-2026-04-11-001',
	groupId: 'group-ops-01',
	accountId: 'account-chatgpt-01',
	workspaceId: 'workspace-atlas-main',
	launchToken: 'signed.launch.token',
	hostOrigin: 'http://127.0.0.1:3737',
	rawParams: {
		opened_from: 'execution_board'
	},
	launchSource: 'founderos_embedded',
	...overrides
});

describe('founderos bootstrap', () => {
	test('resolves the shell bootstrap endpoint from launch context', () => {
		expect(resolveFounderosLaunchBootstrapUrl(launchContext())).toBe(
			'http://127.0.0.1:3737/api/control/execution/workspace/session-2026-04-11-001/bootstrap'
		);
		expect(resolveFounderosLaunchBootstrapUrl(launchContext({ hostOrigin: null }))).toBe(null);
	});

	test('rejects bootstrap when required launch fields are missing', async () => {
		const result = await fetchFounderosLaunchBootstrap(launchContext({ launchToken: null }), vi.fn());
		expect(result.accepted).toBe(false);
		expect(result.payload).toBeNull();
		expect(result.note).toMatch(/requires hostOrigin, sessionId, projectId, and launchToken/i);
	});

	test('accepts a valid shell bootstrap payload', async () => {
		const fetchImpl = vi.fn(async () =>
			new Response(
				JSON.stringify({
					accepted: true,
					canonicalTruth: 'sessionId',
					note: 'Shell bootstrap is valid.',
					user: {
						id: 'founderos-embedded-user',
						email: 'operator@infinity.local',
						name: 'Infinity Operator',
						role: 'user',
						profile_image_url: '/user.png',
						permissions: { chat: { temporary: false } }
					},
					hostContext: {
						projectId: 'project-atlas',
						projectName: 'Atlas Launch',
						sessionId: 'session-2026-04-11-001',
						accountId: 'account-chatgpt-01',
						accountLabel: 'Primary ChatGPT',
						model: 'gpt-5.4',
						openedFrom: 'execution_board'
					},
						auth: {
							mode: 'session_exchange',
							note: 'Exchange the launch token for a shell-issued embedded session.',
							sessionExchangePath:
								'/api/control/execution/workspace/session-2026-04-11-001/session'
						},
					ui: {
						showSidebar: false,
						showControls: false,
						selectedTerminalId: null,
						temporaryChatEnabled: false,
						settings: {
							showChangelog: false,
							showUpdateToast: false,
							models: ['gpt-5.4'],
							toolServers: [],
							terminalServers: []
						},
						models: [
							{
								id: 'gpt-5.4',
								name: 'gpt-5.4',
								owned_by: 'openai',
								external: false,
								source: 'founderos_shell'
							}
						],
						toolServers: [],
						terminalServers: [],
						banners: [],
						tools: null
					}
				})
			)
		);

		const result = await fetchFounderosLaunchBootstrap(launchContext(), fetchImpl as typeof fetch);
		expect(result.accepted).toBe(true);
		expect(result.payload?.hostContext.sessionId).toBe('session-2026-04-11-001');
		expect(result.payload?.ui.models[0]?.id).toBe('gpt-5.4');
	});

	test('accepts bootstrap-only payloads without an issued session token', async () => {
		const fetchImpl = vi.fn(async () =>
			new Response(
				JSON.stringify({
					accepted: true,
					canonicalTruth: 'sessionId',
					note: 'Bootstrap-only launch is valid.',
					user: {
						id: 'founderos-embedded-user',
						email: 'operator@infinity.local',
						name: 'Infinity Operator',
						role: 'user',
						profile_image_url: '/user.png',
						permissions: { chat: { temporary: false } }
					},
					hostContext: {
						projectId: 'project-atlas',
						projectName: 'Atlas Launch',
						sessionId: 'session-2026-04-11-001',
						accountId: 'account-chatgpt-01',
						accountLabel: 'Primary ChatGPT',
						model: 'gpt-5.4',
						openedFrom: 'execution_board'
					},
						auth: {
							mode: 'bootstrap_only',
							note: 'No embedded session exchange is available for this launch.',
							sessionExchangePath:
								'/api/control/execution/workspace/session-2026-04-11-001/session'
						},
					ui: {
						showSidebar: false,
						showControls: false,
						selectedTerminalId: null,
						temporaryChatEnabled: false,
						settings: {
							showChangelog: false,
							showUpdateToast: false,
							models: ['gpt-5.4'],
							toolServers: [],
							terminalServers: []
						},
						models: [
							{
								id: 'gpt-5.4',
								name: 'gpt-5.4',
								owned_by: 'openai',
								external: false,
								source: 'founderos_shell'
							}
						],
						toolServers: [],
						terminalServers: [],
						banners: [],
						tools: null
					}
				})
			)
		);

		const result = await fetchFounderosLaunchBootstrap(launchContext(), fetchImpl as typeof fetch);
		expect(result.accepted).toBe(true);
		expect(result.payload?.auth.mode).toBe('bootstrap_only');
		expect(result.payload?.auth.sessionExchangePath).toBe(
			'/api/control/execution/workspace/session-2026-04-11-001/session'
		);
	});

	test('resolves the shell session exchange endpoint from bootstrap auth state', () => {
		expect(
			resolveFounderosLaunchSessionUrl(launchContext(), {
				sessionExchangePath: '/api/control/execution/workspace/session-2026-04-11-001/session'
			})
		).toBe(
			'http://127.0.0.1:3737/api/control/execution/workspace/session-2026-04-11-001/session'
		);
		expect(resolveFounderosLaunchSessionUrl(launchContext({ hostOrigin: null }))).toBe(null);
	});

	test('does not fall back to compatibility session-bearer path during embedded launch', () => {
		expect(
			resolveFounderosLaunchSessionUrl(launchContext(), {
				sessionBearerExchangePath:
					'/api/control/execution/workspace/session-2026-04-11-001/session-bearer'
			})
		).toBe(
			'http://127.0.0.1:3737/api/control/execution/workspace/session-2026-04-11-001/session'
		);
	});

	test('fails closed when session exchange is missing launch token or host route context', async () => {
		const result = await exchangeFounderosLaunchSession(
			launchContext({ launchToken: null }),
			{
				sessionExchangePath: '/api/control/execution/workspace/session-2026-04-11-001/session'
			},
			vi.fn() as typeof fetch
		);

		expect(result.accepted).toBe(false);
		expect(result.token).toBeNull();
		expect(result.user).toBeNull();
		expect(result.note).toMatch(/launch token/i);
	});

	test('accepts a valid shell session exchange response', async () => {
		const fetchImpl = vi.fn(async () =>
			new Response(
				JSON.stringify({
					accepted: true,
					note: 'Shell-issued embedded session exchanged successfully.',
					session: {
						token: 'embedded.session.token',
						issuedAt: '2026-04-12T00:00:00.000Z',
						expiresAt: '2026-04-12T00:30:00.000Z'
					},
					user: {
						id: 'founderos-embedded-user',
						email: 'operator@infinity.local',
						name: 'Infinity Operator',
						role: 'user',
						profile_image_url: '/user.png',
						permissions: { chat: { temporary: false } }
					},
					sessionGrant: {
						token: 'grant.token',
						issuedAt: '2026-04-12T00:00:00.000Z',
						expiresAt: '2026-04-12T00:30:00.000Z'
					}
				})
			)
		);

		const result = await exchangeFounderosLaunchSession(
			launchContext(),
			{
				sessionExchangePath: '/api/control/execution/workspace/session-2026-04-11-001/session'
			},
			fetchImpl as typeof fetch
		);

		expect(result).toEqual({
			accepted: true,
			note: 'Shell-issued embedded session exchanged successfully.',
			token: 'embedded.session.token',
			storageMode: 'unknown',
			cookieBound: false,
			user: {
				id: 'founderos-embedded-user',
				email: 'operator@infinity.local',
				name: 'Infinity Operator',
				role: 'user',
				profile_image_url: '/user.png',
				permissions: { chat: { temporary: false } }
			},
			sessionGrant: {
				token: 'grant.token',
				grantId: null,
				issuedAt: '2026-04-12T00:00:00.000Z',
				expiresAt: '2026-04-12T00:30:00.000Z',
				refreshAfter: null,
				revokedAt: null
			}
		});
		expect(fetchImpl).toHaveBeenCalledWith(
			'http://127.0.0.1:3737/api/control/execution/workspace/session-2026-04-11-001/session',
			expect.objectContaining({ credentials: 'include' })
		);
	});

	test('accepts cookie-bound production session exchange responses without a JSON bearer token', async () => {
		const fetchImpl = vi.fn(async () =>
			new Response(
				JSON.stringify({
					accepted: true,
					note: 'Cookie-bound session exchanged successfully.',
					session: {
						token: null,
						issuedAt: '2026-04-12T00:00:00.000Z',
						expiresAt: '2026-04-12T00:30:00.000Z',
						refreshAfter: '2026-04-12T00:15:00.000Z',
						deliveryMode: 'http_only_cookie',
						cookieName: 'founderos_workspace_session'
					},
					user: {
						id: 'founderos-embedded-user',
						email: 'operator@infinity.local',
						name: 'Infinity Operator',
						role: 'user',
						profile_image_url: '/user.png',
						permissions: { chat: { temporary: false } }
					},
					sessionGrant: {
						token: null,
						grantId: 'grant-1',
						issuedAt: '2026-04-12T00:00:00.000Z',
						expiresAt: '2026-04-12T00:30:00.000Z',
						refreshAfter: '2026-04-12T00:15:00.000Z'
					}
				})
			)
		);

		const result = await exchangeFounderosLaunchSession(
			launchContext(),
			{
				sessionExchangePath: '/api/control/execution/workspace/session-2026-04-11-001/session'
			},
			fetchImpl as typeof fetch
		);

		expect(result.accepted).toBe(true);
		expect(result.token).toBeNull();
		expect(result.storageMode).toBe('http_only_cookie');
		expect(result.cookieBound).toBe(true);
		expect(result.sessionGrant).toEqual({
			token: null,
			grantId: 'grant-1',
			issuedAt: '2026-04-12T00:00:00.000Z',
			expiresAt: '2026-04-12T00:30:00.000Z',
			refreshAfter: '2026-04-12T00:15:00.000Z',
			revokedAt: null
		});
	});

	test('rejects malformed shell session exchange responses', async () => {
		const fetchImpl = vi.fn(async () =>
			new Response(
				JSON.stringify({
					accepted: true
				})
			)
		);

		const result = await exchangeFounderosLaunchSession(
			launchContext(),
			{
				sessionExchangePath: '/api/control/execution/workspace/session-2026-04-11-001/session'
			},
			fetchImpl as typeof fetch
		);

		expect(result.accepted).toBe(false);
		expect(result.token).toBeNull();
		expect(result.storageMode).toBe('unknown');
		expect(result.cookieBound).toBe(false);
		expect(result.user).toBeNull();
		expect(result.sessionGrant).toBeNull();
		expect(result.note).toMatch(/invalid response/i);
	});

	test('surfaces shell bootstrap failures', async () => {
		const fetchImpl = vi.fn(async () =>
			new Response(
				JSON.stringify({
					accepted: false,
					canonicalTruth: 'sessionId',
					note: 'Workspace launch token has expired.'
				}),
				{ status: 401 }
			)
		);

		const result = await fetchFounderosLaunchBootstrap(launchContext(), fetchImpl as typeof fetch);
		expect(result.accepted).toBe(false);
		expect(result.payload).toBeNull();
		expect(result.note).toMatch(/expired/i);
	});

	test('rejects bootstrap payloads with incomplete ui state', async () => {
		const fetchImpl = vi.fn(async () =>
			new Response(
				JSON.stringify({
					accepted: true,
					canonicalTruth: 'sessionId',
					note: 'Shell bootstrap is valid.',
					user: {
						id: 'founderos-embedded-user',
						email: 'operator@infinity.local',
						name: 'Infinity Operator',
						role: 'user',
						profile_image_url: '/user.png',
						permissions: { chat: { temporary: false } }
					},
					hostContext: {
						projectId: 'project-atlas',
						projectName: 'Atlas Launch',
						sessionId: 'session-2026-04-11-001',
						accountId: 'account-chatgpt-01',
						accountLabel: 'Primary ChatGPT',
						model: 'gpt-5.4',
						openedFrom: 'execution_board'
					},
					auth: {
						mode: 'bootstrap_only',
						note: 'No embedded session exchange is available for this launch.',
						sessionExchangePath:
							'/api/control/execution/workspace/session-2026-04-11-001/session'
					},
					ui: {
						showSidebar: false,
						showControls: false,
						selectedTerminalId: null,
						temporaryChatEnabled: false,
						models: []
					}
				})
			)
		);

		const result = await fetchFounderosLaunchBootstrap(launchContext(), fetchImpl as typeof fetch);
		expect(result.accepted).toBe(false);
		expect(result.payload).toBeNull();
		expect(result.note).toMatch(/invalid response/i);
	});
});
