import type { Model } from '$lib/stores';

export type FeedbackItem = {
	id: string;
	updated_at: number;
	user: {
		id: string;
		name?: string | null;
		email?: string | null;
	};
	data: {
		model_id?: string | null;
		sibling_model_ids?: string[] | null;
		rating?: number | string | null;
		details?: {
			rating?: number | string | null;
		} | null;
		reason?: string | null;
		comment?: string | null;
		tags?: string[] | null;
	};
	meta?: {
		chat_id?: string | null;
		message_id?: string | null;
	} | null;
	snapshot?: Record<string, unknown> | null;
};

export type FeedbackSnapshotMessage = {
	parentId?: string | null;
	content?: string | null;
};

export type FeedbackDetailsResponse = {
	meta?: {
		message_id?: string | null;
	} | null;
	snapshot?: {
		chat?: {
			chat?: {
				history?: {
					messages?: Record<string, FeedbackSnapshotMessage>;
				} | null;
			} | null;
		} | null;
	} | null;
};

export type LeaderboardTag = {
	tag: string;
	count: number;
};

export type LeaderboardEntry = {
	model_id: string;
	rating?: number | null;
	won?: number | null;
	lost?: number | null;
	top_tags?: LeaderboardTag[] | null;
};

export type LeaderboardRow = Model & {
	rating: number | '-';
	stats: {
		count: number;
		won: number | '-';
		lost: number | '-';
	};
	top_tags: LeaderboardTag[];
};
