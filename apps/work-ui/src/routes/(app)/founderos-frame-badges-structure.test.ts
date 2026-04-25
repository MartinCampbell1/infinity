import { readFileSync } from 'node:fs';

import { describe, expect, test } from 'vitest';

const routeSources = [
	{
		name: 'project intake',
		source: readFileSync(new URL('./project-intake/+page.svelte', import.meta.url), 'utf8'),
		expectedBadge: 'Intake form loaded'
	},
	{
		name: 'project brief',
		source: readFileSync(new URL('./project-brief/[id]/+page.svelte', import.meta.url), 'utf8'),
		expectedBadge: 'Brief loaded'
	},
	{
		name: 'project run',
		source: readFileSync(new URL('./project-run/[id]/+page.svelte', import.meta.url), 'utf8'),
		expectedBadge: 'Run loaded'
	}
];

describe('FounderOS frame badge copy', () => {
	for (const route of routeSources) {
		test(`${route.name} badge uses contextual loaded copy`, () => {
			expect(route.source).toContain(route.expectedBadge);
			expect(route.source).not.toContain("? 'Ready'");
			expect(route.source).not.toContain(': \'Ready\'');
			expect(route.source).not.toContain(' : "Ready"');
		});
	}
});
