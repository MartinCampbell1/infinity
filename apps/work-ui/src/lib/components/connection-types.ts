export type ConnectionTag = {
	name: string;
};

export type ConnectionConfig = {
	enable?: boolean;
	tags?: ConnectionTag[];
	prefix_id?: string;
	model_ids?: string[];
	connection_type?: 'external' | 'local';
	auth_type?: string;
	headers?: Record<string, unknown>;
	azure?: boolean;
	api_version?: string;
	api_type?: string;
	key?: string;
};

export type ConnectionForm = {
	url: string;
	key: string;
	config: ConnectionConfig;
};

export type DirectConnectionsConfig = {
	OPENAI_API_BASE_URLS: string[];
	OPENAI_API_KEYS: string[];
	OPENAI_API_CONFIGS: Record<string, ConnectionConfig>;
};

export type ConnectionSettingsFlags = {
	ENABLE_DIRECT_CONNECTIONS?: boolean;
	ENABLE_BASE_MODELS_CACHE?: boolean;
	[key: string]: unknown;
};

export type OpenAIConnectionsConfig = {
	ENABLE_OPENAI_API: boolean;
	OPENAI_API_BASE_URLS: string[];
	OPENAI_API_KEYS: string[];
	OPENAI_API_CONFIGS: Record<string, ConnectionConfig>;
};

export type OllamaConnectionsConfig = {
	ENABLE_OLLAMA_API: boolean;
	OLLAMA_BASE_URLS: string[];
	OLLAMA_API_CONFIGS: Record<string, ConnectionConfig>;
};
