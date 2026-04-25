import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../..');

const readRepoFile = (path: string) => readFileSync(resolve(repoRoot, path), 'utf8');

const tokenSource = readRepoFile('packages/ui/src/styles/tokens.css');
const shellGlobalSource = readRepoFile('apps/shell/apps/web/app/globals.css');
const layoutSource = readFileSync(new URL('./+layout.svelte', import.meta.url), 'utf8');
const embeddedMetaStripSource = readFileSync(
	new URL('../../lib/components/founderos/EmbeddedMetaStrip.svelte', import.meta.url),
	'utf8'
);

describe('FounderOS embedded theme consistency', () => {
	test('defines shared dark seam tokens for shell and embedded workspace surfaces', () => {
		for (const token of [
			'--founderos-shell-bg',
			'--founderos-shell-content-bg',
			'--founderos-shell-border',
			'--founderos-shell-active-border',
			'--founderos-shell-topbar-bg',
			'--founderos-workspace-bg',
			'--founderos-workspace-panel-bg',
			'--founderos-workspace-border',
			'--founderos-workspace-fg',
			'--founderos-workspace-muted',
			'--founderos-workspace-subtle',
			'--founderos-workspace-hover',
			'--founderos-workspace-accent-border',
			'--founderos-focus-ring'
		]) {
			expect(tokenSource).toContain(token);
		}
	});

	test('keeps shell dark palette wired through shared seam tokens', () => {
		for (const tokenUse of [
			'--shell-app-bg: var(--founderos-shell-bg)',
			'--shell-sidebar-bg: var(--founderos-shell-bg)',
			'--shell-surface-card: var(--founderos-workspace-panel-bg)',
			'--shell-nav-active-border: var(--founderos-shell-active-border)',
			'--foreground: var(--founderos-workspace-fg)',
			'--ring: var(--founderos-focus-ring)'
		]) {
			expect(shellGlobalSource).toContain(tokenUse);
		}
	});

	test('uses shared tokens for embedded workspace launch and root seams', () => {
		for (const tokenUse of [
			'founderos-workspace-root',
			'var(--founderos-workspace-bg)',
			'var(--founderos-workspace-fg)',
			'var(--founderos-workspace-panel-bg)',
			'var(--founderos-workspace-border)',
			'var(--founderos-workspace-muted)'
		]) {
			expect(layoutSource).toContain(tokenUse);
		}

		for (const retiredLiteral of [
			'bg-[#08101f]',
			'text-slate-100',
			'bg-slate-900/80',
			'shadow-[0_18px_40px_rgba(15,23,42,0.18)]'
		]) {
			expect(layoutSource).not.toContain(retiredLiteral);
		}
	});

	test('uses shared tokens for the embedded meta strip instead of old slate literals', () => {
		for (const tokenUse of [
			'var(--founderos-workspace-border)',
			'var(--founderos-workspace-glass)',
			'var(--founderos-workspace-panel-bg)',
			'var(--founderos-workspace-fg)',
			'var(--founderos-workspace-muted)',
			'var(--founderos-workspace-subtle)',
			'var(--founderos-workspace-hover)',
			'var(--founderos-workspace-accent-border)'
		]) {
			expect(embeddedMetaStripSource).toContain(tokenUse);
		}

		for (const retiredLiteral of [
			'rgb(15 23 42 / 0.88)',
			'rgb(15 23 42 / 0.7)',
			'rgb(248 250 252 / 0.96)',
			'rgb(226 232 240 / 0.78)',
			'rgb(255 255 255 / 0.06)'
		]) {
			expect(embeddedMetaStripSource).not.toContain(retiredLiteral);
		}
	});
});
