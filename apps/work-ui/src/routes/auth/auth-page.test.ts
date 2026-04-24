import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

describe('auth recovery page', () => {
	test('uses the shell origin resolver instead of a fixed localhost recovery URL', () => {
		const source = readFileSync(new URL('./+page.svelte', import.meta.url), 'utf8');

		expect(source).toContain('resolveFounderosShellOrigin');
		expect(source).not.toContain('const shellOrigin = DEFAULT_LOCAL_SHELL_ORIGIN');
	});
});
