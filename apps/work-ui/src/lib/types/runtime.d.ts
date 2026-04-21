declare const APP_VERSION: string;
declare const APP_BUILD_HASH: string;

declare module 'file-saver' {
	const fileSaver: {
		saveAs: (data: Blob | File | string, filename?: string, options?: unknown) => void;
	};

	export = fileSaver;
}

declare module 'js-sha256' {
	const sha256: (input: string) => string;
	export default sha256;
}

export {};
