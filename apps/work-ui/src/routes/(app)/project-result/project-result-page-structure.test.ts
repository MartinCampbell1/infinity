import { readFileSync } from 'node:fs';

import { describe, expect, test } from 'vitest';

const pageSource = readFileSync(new URL('./[id]/+page.svelte', import.meta.url), 'utf8');

describe('project result page structure', () => {
	test('keeps the default result page summary-first and demotes raw proof details', () => {
		expect(pageSource).toContain('data-result-primary-summary');
		expect(pageSource).toContain('data-result-proof-details');
		expect(pageSource).toContain('Secondary proof details');
		expect(pageSource).not.toContain("<li>Path: {delivery.localOutputPath ?? 'n/a'}</li>");
		expect(pageSource).not.toContain("<li>Command: {delivery.command ?? 'n/a'}</li>");
	});
});
