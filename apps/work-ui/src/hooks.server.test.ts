import { describe, expect, test } from 'vitest';

import { buildWorkUiSecurityHeaders, resolveWorkUiFrameAncestors } from './hooks.server';

const frameAncestorsDirective = (csp: string) =>
	csp
		.split(';')
		.map((directive) => directive.trim())
		.find((directive) => directive.startsWith('frame-ancestors ')) ?? '';

describe('work-ui security headers', () => {
	test('sets CSP with frame boundaries and Trusted Types enforcement', () => {
		const headers = buildWorkUiSecurityHeaders();
		const csp = headers['Content-Security-Policy'];

		expect(csp).toContain("frame-ancestors 'self'");
		expect(csp).toContain('trusted-types default dompurify founderos-work-ui');
		expect(csp).toContain("require-trusted-types-for 'script'");
		expect(headers['X-Content-Type-Options']).toBe('nosniff');
	});

	test('uses explicit production frame ancestors without broad scheme wildcards', () => {
		const headers = buildWorkUiSecurityHeaders({
			NODE_ENV: 'production',
			FOUNDEROS_SHELL_PUBLIC_ORIGIN: 'https://shell.infinity.example',
			FOUNDEROS_WORK_UI_FRAME_ANCESTORS:
				'https://review.infinity.example,https://shell.infinity.example/path'
		});
		const frameAncestors = frameAncestorsDirective(headers['Content-Security-Policy']);

		expect(frameAncestors).toBe(
			"frame-ancestors 'self' https://review.infinity.example https://shell.infinity.example"
		);
		expect(frameAncestors).not.toMatch(/(?:^|\s)https:(?:\s|$)/);
		expect(frameAncestors).not.toMatch(/(?:^|\s)http:(?:\s|$)/);
		expect(frameAncestors).not.toContain('*');
	});

	test('keeps local shell frame ancestors out of production without explicit config', () => {
		expect(resolveWorkUiFrameAncestors({ NODE_ENV: 'production' })).toEqual(["'self'"]);
		expect(resolveWorkUiFrameAncestors({ NODE_ENV: 'development' })).toEqual([
			"'self'",
			'http://localhost:3737',
			'http://127.0.0.1:3737'
		]);
	});
});
