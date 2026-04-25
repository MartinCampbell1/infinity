import { get } from 'svelte/store';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { FounderosLaunchContext } from '$lib/founderos';
import { Shortcut, shortcuts } from '$lib/shortcuts';
import { showSearch, showSettings, showShortcuts, temporaryChatEnabled } from '$lib/stores';

import {
	createWorkspaceKeyboardShortcutHandler,
	isWorkspaceShortcutMatch,
	registerWorkspaceKeyboardShortcuts
} from './workspace-keyboard-shortcuts';

const launchContext = (): FounderosLaunchContext => ({
	enabled: true,
	embedded: true,
	projectId: 'project-atlas',
	sessionId: 'session-001',
	groupId: 'group-ops',
	accountId: 'account-primary',
	workspaceId: 'workspace-main',
	launchToken: 'signed-launch-token',
	hostOrigin: 'https://ops.example.com',
	rawParams: {
		founderos_launch: '1',
		embedded: '1',
		project_id: 'project-atlas',
		session_id: 'session-001',
		host_origin: 'https://ops.example.com'
	},
	launchSource: 'founderos_embedded'
});

const keyboardEvent = (overrides: Partial<KeyboardEvent> = {}) =>
	({
		key: 'k',
		shiftKey: false,
		ctrlKey: false,
		metaKey: false,
		altKey: false,
		preventDefault: vi.fn(),
		...overrides
	}) as KeyboardEvent & { preventDefault: ReturnType<typeof vi.fn> };

const fakeDocument = () => {
	const listeners = new Map<string, EventListener>();
	const elements = new Map<string, { click: ReturnType<typeof vi.fn>; focus: ReturnType<typeof vi.fn> }>();
	const classElements = new Map<string, HTMLElement[]>();

	return {
		activeElement: null as Element | null,
		addEventListener: vi.fn((name: string, listener: EventListener) => {
			listeners.set(name, listener);
		}),
		removeEventListener: vi.fn((name: string, listener: EventListener) => {
			if (listeners.get(name) === listener) {
				listeners.delete(name);
			}
		}),
		getElementById: vi.fn((id: string) => elements.get(id) ?? null),
		getElementsByClassName: vi.fn((className: string) => classElements.get(className) ?? []),
		addElement: (id: string) => {
			const element = { click: vi.fn(), focus: vi.fn() };
			elements.set(id, element);
			return element;
		},
		getListener: (name: string) => listeners.get(name)
	};
};

describe('isWorkspaceShortcutMatch', () => {
	test('matches mod shortcuts across meta and ctrl keys', () => {
		expect(
			isWorkspaceShortcutMatch(
				keyboardEvent({ key: 'k', metaKey: true }),
				shortcuts[Shortcut.SEARCH]
			)
		).toBe(true);
		expect(
			isWorkspaceShortcutMatch(
				keyboardEvent({ key: 'k', ctrlKey: true }),
				shortcuts[Shortcut.SEARCH]
			)
		).toBe(true);
		expect(
			isWorkspaceShortcutMatch(keyboardEvent({ key: 'k' }), shortcuts[Shortcut.SEARCH])
		).toBe(false);
	});
});

describe('workspace keyboard shortcut handler', () => {
	beforeEach(() => {
		showSearch.set(false);
		showSettings.set(false);
		showShortcuts.set(false);
		temporaryChatEnabled.set(false);
	});

	test('toggles search through the extracted handler', async () => {
		const document = fakeDocument();
		const event = keyboardEvent({ key: 'k', metaKey: true });
		const handler = createWorkspaceKeyboardShortcutHandler({
			document,
			getLaunchContext: launchContext,
			navigate: vi.fn(),
			logger: null
		});

		await handler(event);

		expect(event.preventDefault).toHaveBeenCalled();
		expect(get(showSearch)).toBe(true);
	});

	test('closes modal stores from the escape shortcut', async () => {
		showSettings.set(true);
		showShortcuts.set(true);
		const document = fakeDocument();
		const event = keyboardEvent({ key: 'Escape' });
		const handler = createWorkspaceKeyboardShortcutHandler({
			document,
			getLaunchContext: launchContext,
			navigate: vi.fn(),
			logger: null
		});

		await handler(event);

		expect(get(showSettings)).toBe(false);
		expect(get(showShortcuts)).toBe(false);
	});

	test('keeps temporary chat disabled in Hermes-only mode while preserving launch scope', async () => {
		temporaryChatEnabled.set(true);
		const document = fakeDocument();
		const navigate = vi.fn();
		const event = keyboardEvent({ key: "'", metaKey: true, shiftKey: true });
		const handler = createWorkspaceKeyboardShortcutHandler({
			document,
			getLaunchContext: launchContext,
			navigate,
			hermesOnlyChat: true,
			logger: null,
			setTimeoutFn: (callback) => callback()
		});

		await handler(event);

		expect(get(temporaryChatEnabled)).toBe(false);
		expect(navigate).toHaveBeenCalledWith(
			'/?founderos_launch=1&embedded=1&project_id=project-atlas&session_id=session-001&host_origin=https%3A%2F%2Fops.example.com'
		);
	});

	test('registers and cleans up the document keydown listener', () => {
		const document = fakeDocument();
		const cleanup = registerWorkspaceKeyboardShortcuts({
			document,
			getLaunchContext: launchContext,
			navigate: vi.fn(),
			logger: null
		});

		expect(document.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
		expect(document.getListener('keydown')).toEqual(expect.any(Function));

		cleanup();

		expect(document.removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
		expect(document.getListener('keydown')).toBeUndefined();
	});
});
