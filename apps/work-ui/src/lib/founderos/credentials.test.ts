import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
	clearFounderosEmbeddedCredentials,
	getFounderosEmbeddedSessionAuthHeaders,
	persistFounderosEmbeddedCredentials,
	readFounderosEmbeddedSessionGrant,
	readFounderosEmbeddedSessionToken,
	resolveFounderosEmbeddedAccessToken
} from '$lib/founderos/credentials';

describe('founderos embedded credentials', () => {
	beforeEach(() => {
		const storage = new Map<string, string>();
		const sessionStorageState = new Map<string, string>();
		vi.stubGlobal('window', {
			location: {
				href: 'http://localhost/'
			}
		});
		vi.stubGlobal('localStorage', {
			token: '',
			getItem: (key: string) => storage.get(key) ?? null,
			setItem: (key: string, value: string) => {
				storage.set(key, value);
			},
			removeItem: (key: string) => {
				storage.delete(key);
			},
			clear: () => {
				storage.clear();
				(globalThis.localStorage as { token?: string }).token = '';
			}
		});
		vi.stubGlobal('sessionStorage', {
			getItem: (key: string) => sessionStorageState.get(key) ?? null,
			setItem: (key: string, value: string) => {
				sessionStorageState.set(key, value);
			},
			removeItem: (key: string) => {
				sessionStorageState.delete(key);
			},
			clear: () => {
				sessionStorageState.clear();
			}
		});
		clearFounderosEmbeddedCredentials();
		localStorage.clear();
		sessionStorage.clear();
	});

	test('persists and reads session grant metadata', () => {
		persistFounderosEmbeddedCredentials({
			token: 'bearer.session.token',
			sessionGrant: {
				token: 'grant.token',
				issuedAt: '2026-04-12T00:00:00.000Z',
				expiresAt: '2026-04-12T00:30:00.000Z'
			}
		});

		expect(readFounderosEmbeddedSessionGrant()).toEqual({
			token: 'grant.token',
			issuedAt: '2026-04-12T00:00:00.000Z',
			expiresAt: '2026-04-12T00:30:00.000Z'
		});
		expect(readFounderosEmbeddedSessionToken()).toBe('bearer.session.token');
		expect(getFounderosEmbeddedSessionAuthHeaders()).toEqual({
			authorization: 'Bearer bearer.session.token',
			'x-founderos-workspace-session-grant': 'grant.token'
		});
	});

	test('prefers the embedded session token over a legacy localStorage token', () => {
		localStorage.token = 'legacy.browser.token';

		persistFounderosEmbeddedCredentials({
			token: 'bearer.session.token',
			sessionGrant: null
		});

		expect(resolveFounderosEmbeddedAccessToken()).toBe('bearer.session.token');
		expect(getFounderosEmbeddedSessionAuthHeaders()).toEqual({
			authorization: 'Bearer bearer.session.token'
		});
	});

	test('keeps the embedded session token in memory even if compatibility storage is cleared', () => {
		persistFounderosEmbeddedCredentials({
			token: 'bearer.session.token',
			sessionGrant: {
				token: 'grant.token',
				issuedAt: '2026-04-12T00:00:00.000Z',
				expiresAt: '2026-04-12T00:30:00.000Z'
			}
		});

		sessionStorage.removeItem('founderos.workspace.sessionToken');
		sessionStorage.removeItem('founderos.workspace.sessionGrant');
		localStorage.removeItem('founderos.workspace.sessionToken');
		localStorage.removeItem('founderos.workspace.sessionGrant');
		localStorage.token = '';

		expect(readFounderosEmbeddedSessionToken()).toBe('bearer.session.token');
		expect(readFounderosEmbeddedSessionGrant()).toEqual({
			token: 'grant.token',
			issuedAt: '2026-04-12T00:00:00.000Z',
			expiresAt: '2026-04-12T00:30:00.000Z'
		});
		expect(getFounderosEmbeddedSessionAuthHeaders()).toEqual({
			authorization: 'Bearer bearer.session.token',
			'x-founderos-workspace-session-grant': 'grant.token'
		});
	});

	test('stores embedded session state in sessionStorage while leaving localStorage session keys empty', () => {
		persistFounderosEmbeddedCredentials({
			token: 'bearer.session.token',
			sessionGrant: {
				token: 'grant.token',
				issuedAt: '2026-04-12T00:00:00.000Z',
				expiresAt: '2026-04-12T00:30:00.000Z'
			}
		});

		expect(sessionStorage.getItem('founderos.workspace.sessionToken')).toBe('bearer.session.token');
		expect(sessionStorage.getItem('founderos.workspace.sessionGrant')).toContain('grant.token');
		expect(localStorage.getItem('founderos.workspace.sessionToken')).toBeNull();
		expect(localStorage.getItem('founderos.workspace.sessionGrant')).toBeNull();
		expect(localStorage.token).toBe('');
	});

	test('falls back to the legacy localStorage token when no embedded token exists', () => {
		localStorage.token = 'legacy.browser.token';

		expect(readFounderosEmbeddedSessionToken()).toBeNull();
		expect(resolveFounderosEmbeddedAccessToken()).toBe('legacy.browser.token');
		expect(getFounderosEmbeddedSessionAuthHeaders()).toEqual({
			authorization: 'Bearer legacy.browser.token'
		});
	});

	test('fails closed in embedded mode when only a legacy browser token exists', () => {
		(globalThis.window as { location: { href: string } }).location.href =
			'http://localhost/workspace?embedded=1&project_id=project-1&session_id=session-1';
		localStorage.token = 'legacy.browser.token';

		expect(readFounderosEmbeddedSessionToken()).toBeNull();
		expect(resolveFounderosEmbeddedAccessToken()).toBe('');
		expect(getFounderosEmbeddedSessionAuthHeaders()).toEqual({});
	});

	test('fails closed in embedded mode when only legacy localStorage session keys exist', () => {
		(globalThis.window as { location: { href: string } }).location.href =
			'http://localhost/workspace?embedded=1&project_id=project-1&session_id=session-1';
		localStorage.setItem('founderos.workspace.sessionToken', 'legacy.session.token');
		localStorage.setItem(
			'founderos.workspace.sessionGrant',
			JSON.stringify({
				token: 'legacy.grant.token',
				issuedAt: '2026-04-12T00:00:00.000Z',
				expiresAt: '2026-04-12T00:30:00.000Z'
			})
		);

		expect(readFounderosEmbeddedSessionToken()).toBeNull();
		expect(readFounderosEmbeddedSessionGrant()).toBeNull();
		expect(resolveFounderosEmbeddedAccessToken()).toBe('');
		expect(getFounderosEmbeddedSessionAuthHeaders()).toEqual({});
	});

	test('fails closed in shell-issued session mode when embedded token is missing', () => {
		localStorage.token = 'legacy.browser.token';

		expect(
			resolveFounderosEmbeddedAccessToken({
				allowLegacyToken: false
			})
		).toBe('');
	});

	test('ignores explicit legacy-token allowance during embedded launch mode', () => {
		(globalThis.window as { location: { href: string } }).location.href =
			'http://localhost/workspace?founderos_launch=1&project_id=project-1&session_id=session-1';
		localStorage.token = 'legacy.browser.token';

		expect(
			resolveFounderosEmbeddedAccessToken({
				allowLegacyToken: true
			})
		).toBe('');
	});

	test('does not revive legacy browser token when a shell-issued session grant exists without an embedded token', () => {
		localStorage.token = 'legacy.browser.token';
		localStorage.setItem(
			'founderos.workspace.sessionGrant',
			JSON.stringify({
				token: 'grant.token',
				issuedAt: '2026-04-12T00:00:00.000Z',
				expiresAt: '2026-04-12T00:30:00.000Z'
			})
		);

		expect(resolveFounderosEmbeddedAccessToken()).toBe('');
		expect(getFounderosEmbeddedSessionAuthHeaders()).toEqual({
			'x-founderos-workspace-session-grant': 'grant.token'
		});
	});

	test('clears embedded bearer and session grant state when there is no prior token', () => {
		persistFounderosEmbeddedCredentials({
			token: 'bearer.session.token',
			sessionGrant: {
				token: 'grant.token',
				issuedAt: '2026-04-12T00:00:00.000Z',
				expiresAt: '2026-04-12T00:30:00.000Z'
			}
		});

		clearFounderosEmbeddedCredentials();

		expect(readFounderosEmbeddedSessionGrant()).toBeNull();
		expect(localStorage.token).toBe('');
		expect(getFounderosEmbeddedSessionAuthHeaders()).toEqual({});
	});

	test('does not overwrite the legacy browser token when persisting embedded credentials', () => {
		localStorage.token = 'user.session.token';

		persistFounderosEmbeddedCredentials({
			token: 'bearer.session.token',
			sessionGrant: {
				token: 'grant.token',
				issuedAt: '2026-04-12T00:00:00.000Z',
				expiresAt: '2026-04-12T00:30:00.000Z'
			}
		});

		expect(localStorage.token).toBe('user.session.token');
		expect(resolveFounderosEmbeddedAccessToken()).toBe('bearer.session.token');
	});

	test('leaves the previous bearer token untouched when clearing embedded credentials', () => {
		localStorage.token = 'user.session.token';

		persistFounderosEmbeddedCredentials({
			token: 'bearer.session.token',
			sessionGrant: {
				token: 'grant.token',
				issuedAt: '2026-04-12T00:00:00.000Z',
				expiresAt: '2026-04-12T00:30:00.000Z'
			}
		});

		clearFounderosEmbeddedCredentials();

		expect(readFounderosEmbeddedSessionGrant()).toBeNull();
		expect(localStorage.token).toBe('user.session.token');
		expect(getFounderosEmbeddedSessionAuthHeaders()).toEqual({
			authorization: 'Bearer user.session.token'
		});
	});
});
