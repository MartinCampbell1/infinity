export interface ChatMessageMergedState {
	status?: string | null;
	content?: string | null;
	timestamp?: number | string | null;
	[key: string]: unknown;
}

export interface ChatMessage {
	id: string;
	role?: string;
	content?: string | null;
	done?: boolean | null;
	parentId?: string | null;
	childrenIds: string[];
	models?: string[] | null;
	model?: string | null;
	modelIdx?: number | null;
	merged?: ChatMessageMergedState | null;
	timestamp?: number | null;
	[key: string]: unknown;
}

export interface MessageHistory {
	messages: Record<string, ChatMessage>;
	currentId: string | null;
	[key: string]: unknown;
}

export interface MessageGroupEntry {
	messageIds: string[];
}

export type MessageGroupMap = Record<string, MessageGroupEntry>;
export type MessageGroupIndexMap = Record<string, number>;
