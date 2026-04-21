declare const APP_VERSION: string;
declare const APP_BUILD_HASH: string;

declare module 'file-saver' {
	export function saveAs(data: Blob | File | string, filename?: string, options?: unknown): void;
}

declare module 'uuid' {
	export function v4(): string;
}

declare module 'js-sha256' {
	const sha256: (input: string) => string;
	export default sha256;
}
