type WidenBooleans<T> = T extends boolean
	? boolean
	: T extends object
		? { -readonly [K in keyof T]: WidenBooleans<T[K]> }
		: T;

const DEFAULT_PERMISSIONS_TEMPLATE = {
	workspace: {
		models: false,
		knowledge: false,
		prompts: false,
		tools: false,
		skills: false,
		models_import: false,
		models_export: false,
		prompts_import: false,
		prompts_export: false,
		tools_import: false,
		tools_export: false
	},
	sharing: {
		models: false,
		public_models: false,
		knowledge: false,
		public_knowledge: false,
		prompts: false,
		public_prompts: false,
		tools: false,
		public_tools: false,
		skills: false,
		public_skills: false,
		notes: false,
		public_notes: false
	},
	access_grants: {
		allow_users: true
	},
	chat: {
		controls: true,
		valves: true,
		system_prompt: true,
		params: true,
		file_upload: true,
		web_upload: true,
		delete: true,
		delete_message: true,
		continue_response: true,
		regenerate_response: true,
		rate_response: true,
		edit: true,
		share: true,
		export: true,
		stt: true,
		tts: true,
		call: true,
		multiple_models: true,
		temporary: true,
		temporary_enforced: false
	},
	features: {
		api_keys: false,
		notes: true,
		channels: true,
		folders: true,
		direct_tool_servers: false,
		web_search: true,
		image_generation: true,
		code_interpreter: true,
		memories: true
	},
	settings: {
		interface: true
	}
} as const;

export type GroupPermissions = WidenBooleans<typeof DEFAULT_PERMISSIONS_TEMPLATE>;

export type PartialGroupPermissions = {
	[K in keyof GroupPermissions]?: Partial<GroupPermissions[K]>;
};

export const createDefaultPermissions = (): GroupPermissions => ({
	workspace: { ...DEFAULT_PERMISSIONS_TEMPLATE.workspace },
	sharing: { ...DEFAULT_PERMISSIONS_TEMPLATE.sharing },
	access_grants: { ...DEFAULT_PERMISSIONS_TEMPLATE.access_grants },
	chat: { ...DEFAULT_PERMISSIONS_TEMPLATE.chat },
	features: { ...DEFAULT_PERMISSIONS_TEMPLATE.features },
	settings: { ...DEFAULT_PERMISSIONS_TEMPLATE.settings }
});

export const mergeGroupPermissions = (
	permissions: PartialGroupPermissions | GroupPermissions | null | undefined = {}
): GroupPermissions => {
	const defaults = createDefaultPermissions();
	const source = permissions ?? {};

	return {
		...defaults,
		...source,
		workspace: { ...defaults.workspace, ...(source.workspace ?? {}) },
		sharing: { ...defaults.sharing, ...(source.sharing ?? {}) },
		access_grants: { ...defaults.access_grants, ...(source.access_grants ?? {}) },
		chat: { ...defaults.chat, ...(source.chat ?? {}) },
		features: { ...defaults.features, ...(source.features ?? {}) },
		settings: { ...defaults.settings, ...(source.settings ?? {}) }
	};
};

export const DEFAULT_PERMISSIONS = createDefaultPermissions();
