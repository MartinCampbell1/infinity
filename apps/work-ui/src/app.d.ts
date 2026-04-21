import type { I18nStore } from '$lib/i18n';

// See https://kit.svelte.dev/docs/types#app
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface Platform {}
	}

	const APP_VERSION: string;
	const APP_BUILD_HASH: string;
}

declare module 'svelte' {
	export function getContext(key: 'i18n'): I18nStore;
}

declare module 'file-saver' {
	const fileSaver: {
		saveAs: (data: Blob | File | string, filename?: string, options?: unknown) => void;
	};

	export = fileSaver;
}

declare module 'uuid' {
	export function v4(): string;
}

declare module 'js-sha256' {
	const sha256: (input: string) => string;
	export default sha256;
}

export {};
