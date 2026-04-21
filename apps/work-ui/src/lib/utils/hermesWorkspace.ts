export type HermesWorkspacePreviewMode =
	| 'text'
	| 'image'
	| 'video'
	| 'audio'
	| 'pdf'
	| 'sqlite'
	| 'office'
	| 'unsupported';

export type HermesGeneratedWorkspaceFile = {
	name: string;
	content?: string | null;
	contentType?: string | null;
	fileId?: string | null;
	url?: string | null;
	size?: number | null;
	executionName?: string | null;
	reference?: string | null;
	previewable?: boolean;
};

export type HermesWorkspaceSurfaceItem = {
	id: string;
	name: string;
	source: 'chat' | 'generated' | 'workspace';
	type: 'file' | 'folder' | string;
	reference: string | null;
	url: string | null;
	size: number | null;
	content: string | null;
	contentType: string | null;
	fileId: string | null;
	executionName: string | null;
	previewable: boolean;
};

type WorkspaceLikeFile = Record<string, unknown>;

const TEXT_EXTENSIONS = new Set([
	'txt',
	'md',
	'markdown',
	'json',
	'jsonl',
	'csv',
	'tsv',
	'log',
	'yml',
	'yaml',
	'xml',
	'html',
	'htm',
	'js',
	'ts',
	'jsx',
	'tsx',
	'css',
	'scss',
	'sass',
	'py',
	'go',
	'rs',
	'java',
	'c',
	'cpp',
	'h',
	'hpp',
	'sql',
	'ini',
	'env'
]);

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'avif']);
const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'mov', 'm4v', 'avi']);
const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac']);
const OFFICE_EXTENSIONS = new Set(['docx', 'xlsx', 'pptx', 'doc', 'xls', 'ppt']);

const getFileExtension = (name: string) => {
	const normalized = name.trim().toLowerCase();
	const parts = normalized.split('.');
	return parts.length > 1 ? parts.at(-1) ?? '' : '';
};

const getString = (value: unknown): string | null => {
	return typeof value === 'string' && value.trim() ? value.trim() : null;
};

const getNumber = (value: unknown): number | null => {
	return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

const getBool = (value: unknown): boolean => value === true;

const getFileName = (item: WorkspaceLikeFile, fallback: string) =>
	getString(item.name) ?? getString(item.filename) ?? getString(item.file_name) ?? fallback;

const getReference = (item: WorkspaceLikeFile, fallback: string) =>
	getString(item.reference) ?? getString(item.path) ?? getString(item.full_path) ?? fallback;

const getUrl = (item: WorkspaceLikeFile) =>
	getString(item.url) ?? getString(item.href) ?? getString(item.download_url);

const getContent = (item: WorkspaceLikeFile) => getString(item.content) ?? null;

const getContentType = (item: WorkspaceLikeFile) =>
	getString(item.contentType) ??
	getString(item.content_type) ??
	getString(item.mimeType) ??
	getString(item.mime_type);

const getFileId = (item: WorkspaceLikeFile) =>
	getString(item.fileId) ?? getString(item.file_id) ?? getString(item.id);

const inferSource = (item: WorkspaceLikeFile): 'chat' | 'generated' | 'workspace' => {
	const source = getString(item.source);
	if (source === 'generated' || source === 'workspace' || source === 'chat') {
		return source;
	}

	if (getBool(item.is_generated) || getBool(item.generated)) {
		return 'generated';
	}

	return getFileId(item) ? 'chat' : 'workspace';
};

const inferType = (item: WorkspaceLikeFile) => {
	const type = getString(item.type);
	if (type) {
		return type;
	}

	const folder = getBool(item.is_directory) || getBool(item.directory);
	return folder ? 'folder' : 'file';
};

export const getHermesWorkspacePreviewMode = (
	name: string,
	contentType?: string | null
): HermesWorkspacePreviewMode => {
	const extension = getFileExtension(name);
	const normalizedContentType = (contentType ?? '').trim().toLowerCase();

	if (
		normalizedContentType.startsWith('text/') ||
		normalizedContentType.includes('json') ||
		TEXT_EXTENSIONS.has(extension)
	) {
		return 'text';
	}

	if (normalizedContentType.startsWith('image/') || IMAGE_EXTENSIONS.has(extension)) {
		return 'image';
	}

	if (normalizedContentType.startsWith('video/') || VIDEO_EXTENSIONS.has(extension)) {
		return 'video';
	}

	if (normalizedContentType.startsWith('audio/') || AUDIO_EXTENSIONS.has(extension)) {
		return 'audio';
	}

	if (normalizedContentType.includes('pdf') || extension === 'pdf') {
		return 'pdf';
	}

	if (
		normalizedContentType.includes('sqlite') ||
		normalizedContentType.includes('x-sqlite') ||
		extension === 'sqlite' ||
		extension === 'db'
	) {
		return 'sqlite';
	}

	if (
		normalizedContentType.includes('officedocument') ||
		OFFICE_EXTENSIONS.has(extension)
	) {
		return 'office';
	}

	return 'unsupported';
};

export const buildHermesWorkspaceSurfaceItems = (
	chatFiles: WorkspaceLikeFile[] = [],
	generatedFiles: HermesGeneratedWorkspaceFile[] = []
): HermesWorkspaceSurfaceItem[] => {
	const chatItems = (Array.isArray(chatFiles) ? chatFiles : [])
		.map((item, index) => {
			const name = getFileName(item, `chat-file-${index + 1}`);
			const reference = getReference(item, name);
			const contentType = getContentType(item);

			return {
				id: `chat:${getFileId(item) ?? reference}:${index}`,
				name,
				source: 'chat' as const,
				type: inferType(item),
				reference,
				url: getUrl(item),
				size: getNumber(item.size) ?? null,
				content: getContent(item),
				contentType,
				fileId: getFileId(item),
				executionName: getString(item.executionName) ?? getString(item.execution_name),
				previewable: getBool(item.previewable) || getHermesWorkspacePreviewMode(name, contentType) !== 'unsupported'
			};
		})
		.filter((item) => !!item.name);

	const generatedItems = (Array.isArray(generatedFiles) ? generatedFiles : [])
		.map((item, index) => {
			const name = getFileName(item, `generated-file-${index + 1}`);
			const contentType = getContentType(item);
			return {
				id: `generated:${getFileId(item) ?? name}:${index}`,
				name,
				source: 'generated' as const,
				type: 'file',
				reference: getReference(item, name),
				url: getUrl(item),
				size: getNumber(item.size) ?? null,
				content: getContent(item),
				contentType,
				fileId: getFileId(item),
				executionName: getString(item.executionName) ?? null,
				previewable: getBool(item.previewable) || getHermesWorkspacePreviewMode(name, contentType) !== 'unsupported'
			};
		})
		.filter((item) => !!item.name);

	return [...chatItems, ...generatedItems];
};

export const getValidHermesGeneratedFiles = (files: unknown): HermesGeneratedWorkspaceFile[] => {
	if (!Array.isArray(files)) {
		return [];
	}

	const validFiles: HermesGeneratedWorkspaceFile[] = [];

	for (const file of files as WorkspaceLikeFile[]) {
		const candidate = {
			name: getFileName(file, ''),
			url: getUrl(file),
			executionName: getString(file.executionName) ?? getString(file.execution_name)
		};

		if (!candidate.name || !candidate.url) {
			continue;
		}

		validFiles.push(candidate);
	}

	return validFiles;
};

const getMessageGeneratedFiles = (message: Record<string, unknown>, messageIndex: number) => {
	const files: HermesGeneratedWorkspaceFile[] = [];

	const pushFile = (candidate: Record<string, unknown>, fallbackName: string) => {
		const name =
			typeof candidate.name === 'string' && candidate.name.trim()
				? candidate.name.trim()
				: fallbackName;
		files.push({
			name,
			content:
				typeof candidate.content === 'string'
					? candidate.content
					: typeof candidate.text === 'string'
						? candidate.text
						: null,
			contentType:
				typeof candidate.contentType === 'string'
					? candidate.contentType
					: typeof candidate.content_type === 'string'
						? candidate.content_type
						: null,
			fileId:
				typeof candidate.fileId === 'string'
					? candidate.fileId
					: typeof candidate.file_id === 'string'
						? candidate.file_id
						: null,
			url:
				typeof candidate.url === 'string'
					? candidate.url
					: typeof candidate.href === 'string'
						? candidate.href
						: null,
			size:
				typeof candidate.size === 'number' && Number.isFinite(candidate.size)
					? candidate.size
					: null,
			executionName:
				typeof candidate.executionName === 'string'
					? candidate.executionName
					: typeof candidate.execution_name === 'string'
						? candidate.execution_name
						: null,
			reference:
				typeof candidate.reference === 'string'
					? candidate.reference
					: typeof candidate.path === 'string'
						? candidate.path
						: name,
			previewable: true
		});
	};

	const filesFromMessage = Array.isArray(message.files) ? message.files : [];
	for (const [index, file] of filesFromMessage.entries()) {
		if (file && typeof file === 'object') {
			pushFile(file as Record<string, unknown>, `attachment-${messageIndex + 1}-${index + 1}`);
		}
	}

	const codeExecutions = Array.isArray(message.code_executions) ? message.code_executions : [];
	for (const [index, execution] of codeExecutions.entries()) {
		if (!execution || typeof execution !== 'object') {
			continue;
		}

		const result = (execution as Record<string, unknown>).result;
		if (result && typeof result === 'object' && !Array.isArray(result)) {
			const resultRecord = result as Record<string, unknown>;
			const resultFiles = Array.isArray(resultRecord.files) ? resultRecord.files : [];
			for (const [fileIndex, candidate] of resultFiles.entries()) {
				if (candidate && typeof candidate === 'object') {
					pushFile(
						candidate as Record<string, unknown>,
						`execution-${messageIndex + 1}-${index + 1}-${fileIndex + 1}`
					);
				}
			}
		}
	}

	return files;
};

export const collectHermesGeneratedWorkspaceFiles = (history: Record<string, unknown>) => {
	const messages = history?.messages;
	if (!messages || typeof messages !== 'object') {
		return [];
	}

	const orderedMessages = Object.entries(messages as Record<string, Record<string, unknown>>)
		.sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey));

	const generatedFiles: HermesGeneratedWorkspaceFile[] = [];

	for (const [index, [, message]] of orderedMessages.entries()) {
		generatedFiles.push(...getMessageGeneratedFiles(message, index));
	}

	return generatedFiles;
};
