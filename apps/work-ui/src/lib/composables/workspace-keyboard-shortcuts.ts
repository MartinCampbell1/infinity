import { get } from 'svelte/store';

import type { FounderosLaunchContext } from '$lib/founderos';
import { buildFounderosRootHref } from '$lib/founderos/navigation';
import { Shortcut, shortcuts } from '$lib/shortcuts';
import {
	showSearch,
	showSettings,
	showShortcuts,
	showSidebar,
	temporaryChatEnabled
} from '$lib/stores';

type ShortcutDefinition = (typeof shortcuts)[Shortcut];

type KeyboardElement = {
	id?: string;
	click?: () => void;
	focus?: () => void;
};

type KeyboardTarget = {
	addEventListener: (name: 'keydown', listener: EventListener) => void;
	removeEventListener: (name: 'keydown', listener: EventListener) => void;
	getElementById: (id: string) => KeyboardElement | null;
	getElementsByClassName: (className: string) => ArrayLike<KeyboardElement>;
	activeElement?: KeyboardElement | null;
};

export interface WorkspaceKeyboardShortcutsOptions {
	document: KeyboardTarget;
	getLaunchContext: () => FounderosLaunchContext;
	navigate: (href: string) => Promise<unknown> | unknown;
	hermesOnlyChat?: boolean;
	logger?: Pick<Console, 'log'> | null;
	setTimeoutFn?: (handler: () => void, timeout?: number) => unknown;
}

export const isWorkspaceShortcutMatch = (
	event: Pick<KeyboardEvent, 'key' | 'shiftKey' | 'ctrlKey' | 'metaKey' | 'altKey'>,
	shortcut?: ShortcutDefinition
) => {
	const keys = shortcut?.keys || [];
	const normalized = keys.map((key) => key.toLowerCase());
	const needCtrl = normalized.includes('ctrl') || normalized.includes('mod');
	const needShift = normalized.includes('shift');
	const needAlt = normalized.includes('alt');
	const mainKeys = normalized.filter((key) => !['ctrl', 'shift', 'alt', 'mod'].includes(key));
	const keyPressed = event.key.toLowerCase();

	if (needShift && !event.shiftKey) return false;
	if (needCtrl && !(event.ctrlKey || event.metaKey)) return false;
	if (!needCtrl && (event.ctrlKey || event.metaKey)) return false;
	if (needAlt && !event.altKey) return false;
	if (!needAlt && event.altKey) return false;
	if (mainKeys.length && !mainKeys.includes(keyPressed)) return false;

	return true;
};

const clickLastByClass = (document: KeyboardTarget, className: string) => {
	const element = Array.from(document.getElementsByClassName(className)).at(-1);
	element?.click?.();
};

const clickElementById = (document: KeyboardTarget, id: string) => {
	document.getElementById(id)?.click?.();
};

const logShortcut = (logger: Pick<Console, 'log'> | null | undefined, name: string) => {
	logger?.log(`Shortcut triggered: ${name}`);
};

export const createWorkspaceKeyboardShortcutHandler =
	(options: WorkspaceKeyboardShortcutsOptions) =>
	async (event: KeyboardEvent) => {
		const {
			document,
			getLaunchContext,
			navigate,
			hermesOnlyChat = false,
			logger = console,
			setTimeoutFn = setTimeout
		} = options;

		if (isWorkspaceShortcutMatch(event, shortcuts[Shortcut.SEARCH])) {
			logShortcut(logger, 'SEARCH');
			event.preventDefault();
			showSearch.set(!get(showSearch));
		} else if (isWorkspaceShortcutMatch(event, shortcuts[Shortcut.NEW_CHAT])) {
			logShortcut(logger, 'NEW_CHAT');
			event.preventDefault();
			clickElementById(document, 'sidebar-new-chat-button');
		} else if (isWorkspaceShortcutMatch(event, shortcuts[Shortcut.FOCUS_INPUT])) {
			logShortcut(logger, 'FOCUS_INPUT');
			event.preventDefault();
			document.getElementById('chat-input')?.focus?.();
		} else if (isWorkspaceShortcutMatch(event, shortcuts[Shortcut.COPY_LAST_CODE_BLOCK])) {
			logShortcut(logger, 'COPY_LAST_CODE_BLOCK');
			event.preventDefault();
			clickLastByClass(document, 'copy-code-button');
		} else if (isWorkspaceShortcutMatch(event, shortcuts[Shortcut.COPY_LAST_RESPONSE])) {
			logShortcut(logger, 'COPY_LAST_RESPONSE');
			event.preventDefault();
			clickLastByClass(document, 'copy-response-button');
		} else if (isWorkspaceShortcutMatch(event, shortcuts[Shortcut.TOGGLE_SIDEBAR])) {
			logShortcut(logger, 'TOGGLE_SIDEBAR');
			event.preventDefault();
			showSidebar.set(!get(showSidebar));
		} else if (isWorkspaceShortcutMatch(event, shortcuts[Shortcut.DELETE_CHAT])) {
			logShortcut(logger, 'DELETE_CHAT');
			event.preventDefault();
			clickElementById(document, 'delete-chat-button');
		} else if (isWorkspaceShortcutMatch(event, shortcuts[Shortcut.OPEN_SETTINGS])) {
			logShortcut(logger, 'OPEN_SETTINGS');
			event.preventDefault();
			showSettings.set(!get(showSettings));
		} else if (isWorkspaceShortcutMatch(event, shortcuts[Shortcut.SHOW_SHORTCUTS])) {
			logShortcut(logger, 'SHOW_SHORTCUTS');
			event.preventDefault();
			showShortcuts.set(!get(showShortcuts));
		} else if (isWorkspaceShortcutMatch(event, shortcuts[Shortcut.CLOSE_MODAL])) {
			logShortcut(logger, 'CLOSE_MODAL');
			event.preventDefault();
			showSettings.set(false);
			showShortcuts.set(false);
		} else if (isWorkspaceShortcutMatch(event, shortcuts[Shortcut.OPEN_MODEL_SELECTOR])) {
			logShortcut(logger, 'OPEN_MODEL_SELECTOR');
			event.preventDefault();
			clickElementById(document, 'model-selector-0-button');
		} else if (isWorkspaceShortcutMatch(event, shortcuts[Shortcut.NEW_TEMPORARY_CHAT])) {
			logShortcut(logger, 'NEW_TEMPORARY_CHAT');
			event.preventDefault();
			temporaryChatEnabled.set(hermesOnlyChat ? false : !get(temporaryChatEnabled));
			await navigate(buildFounderosRootHref(getLaunchContext()));
			setTimeoutFn(() => {
				clickElementById(document, 'new-chat-button');
			}, 0);
		} else if (isWorkspaceShortcutMatch(event, shortcuts[Shortcut.GENERATE_MESSAGE_PAIR])) {
			logShortcut(logger, 'GENERATE_MESSAGE_PAIR');
			event.preventDefault();
			clickElementById(document, 'generate-message-pair-button');
		} else if (
			isWorkspaceShortcutMatch(event, shortcuts[Shortcut.REGENERATE_RESPONSE]) &&
			document.activeElement?.id === 'chat-input'
		) {
			logShortcut(logger, 'REGENERATE_RESPONSE');
			event.preventDefault();
			clickLastByClass(document, 'regenerate-response-button');
		}
	};

export const registerWorkspaceKeyboardShortcuts = (
	options: WorkspaceKeyboardShortcutsOptions
) => {
	const handler = createWorkspaceKeyboardShortcutHandler(options) as unknown as EventListener;
	options.document.addEventListener('keydown', handler);

	return () => {
		options.document.removeEventListener('keydown', handler);
	};
};
