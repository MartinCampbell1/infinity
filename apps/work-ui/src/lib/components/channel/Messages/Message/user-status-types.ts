export type ChannelUserGroup = {
	name: string;
};

export type ChannelUserRecord = {
	id: string;
	name: string;
	email?: string | null;
	is_active?: boolean;
	status_emoji?: string | null;
	status_message?: string | null;
	bio?: string | null;
	groups?: ChannelUserGroup[];
};
