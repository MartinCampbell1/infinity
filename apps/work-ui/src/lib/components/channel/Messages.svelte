<script lang="ts">
	import { toast } from 'svelte-sonner';

	import dayjs from 'dayjs';
	import relativeTime from 'dayjs/plugin/relativeTime';
	import isToday from 'dayjs/plugin/isToday';
	import isYesterday from 'dayjs/plugin/isYesterday';

	dayjs.extend(relativeTime);
	dayjs.extend(isToday);
	dayjs.extend(isYesterday);
	import { tick, getContext, onMount, createEventDispatcher } from 'svelte';

	import { settings, user } from '$lib/stores';

	import Message from './Messages/Message.svelte';
	import Loader from '../common/Loader.svelte';
	import Spinner from '../common/Spinner.svelte';
	import {
		addReaction,
		deleteMessage,
		pinMessage,
		removeReaction,
		updateMessage
	} from '$lib/apis/channels';
	import { WEBUI_API_BASE_URL } from '$lib/constants';
	import { resolveFounderosEmbeddedAccessToken } from '$lib/founderos/credentials';

	const i18n = getContext('i18n');

	type ChannelParticipant = {
		id: string;
		name: string;
	};

	type ChannelState = {
		id: string;
		type?: string;
		name?: string;
		users?: ChannelParticipant[];
		created_at?: number;
		write_access?: boolean;
		[key: string]: unknown;
	} | null;

	type ChannelReactionUser = {
		id: string;
		name?: string | null;
	};

	type ChannelReaction = {
		name: string;
		users: ChannelReactionUser[];
		count: number;
	};

	type ChannelMessageMeta = {
		model_id?: string | null;
		model_name?: string | null;
		[key: string]: unknown;
	};

	type ChannelMessage = {
		id: string;
		channel_id: string;
		user_id?: string | null;
		user?: {
			id: string;
			name?: string | null;
			[key: string]: unknown;
		} | null;
		content?: string | null;
		temp_id?: string | null;
		reply_to_message?: ChannelMessage | null;
		reactions?: ChannelReaction[] | null;
		meta?: ChannelMessageMeta | null;
		is_pinned?: boolean;
		pinned_by?: string | null;
		pinned_at?: number | null;
		[key: string]: unknown;
	};

	export let id: string | null = null;
	export let channel: ChannelState = null;
	export let messages: ChannelMessage[] = [];
	export let replyToMessage: ChannelMessage | null = null;
	export let top = false;
	export let thread = false;

	export let onLoad: () => void | Promise<void> = () => {};
	export let onReply: (message: ChannelMessage) => void | Promise<void> = () => {};
	export let onThread: (messageId: string) => void = () => {};

	let messagesLoading = false;

	const getAuthToken = () => resolveFounderosEmbeddedAccessToken();

	const getCurrentUser = (): ChannelReactionUser | null =>
		$user?.id ? { id: $user.id, name: $user.name ?? null } : null;

	const handleDelete = async (message: ChannelMessage) => {
		messages = messages.filter((m) => m.id !== message.id);

		try {
			await deleteMessage(getAuthToken(), message.channel_id, message.id);
		} catch (error) {
			toast.error(`${error}`);
		}
	};

	const handleEdit = async (message: ChannelMessage, content: string) => {
		messages = messages.map((m) => {
			if (m.id === message.id) {
				return { ...m, content };
			}

			return m;
		});

		try {
			await updateMessage(getAuthToken(), message.channel_id, message.id, {
				content
			});
		} catch (error) {
			toast.error(`${error}`);
		}
	};

	const handlePin = async (message: ChannelMessage) => {
		const pinned = !message.is_pinned;

		messages = messages.map((m) => {
			if (m.id === message.id) {
				return {
					...m,
					is_pinned: pinned,
					pinned_by: pinned ? $user?.id ?? null : null,
					pinned_at: pinned ? Date.now() * 1000000 : null
				};
			}

			return m;
		});

		try {
			await pinMessage(getAuthToken(), message.channel_id, message.id, Boolean(message.is_pinned));
		} catch (error) {
			toast.error(`${error}`);
		}
	};

	const handleReaction = async (message: ChannelMessage, name: string) => {
		const currentUser = getCurrentUser();

		if (!currentUser) {
			return;
		}

		const reactions = message.reactions ?? [];
		const hasReaction = reactions
			.find((reaction) => reaction.name === name)
			?.users?.some((u) => u.id === currentUser.id);

		if (hasReaction) {
			messages = messages.map((m) => {
				if (m.id === message.id && m.reactions) {
					const updatedReactions = m.reactions.map((reaction) => {
						if (reaction.name !== name) {
							return reaction;
						}

						const users = reaction.users.filter((u) => u.id !== currentUser.id);

						return {
							...reaction,
							users,
							count: users.length
						};
					});

					return {
						...m,
						reactions: updatedReactions.filter((reaction) => reaction.count > 0)
					};
				}

				return m;
			});

			try {
				await removeReaction(getAuthToken(), message.channel_id, message.id, name);
			} catch (error) {
				toast.error(`${error}`);
			}
		} else {
			messages = messages.map((m) => {
				if (m.id === message.id) {
					const existingReactions = m.reactions ?? [];
					const reaction = existingReactions.find((reaction) => reaction.name === name);

					if (reaction) {
						const users = [...reaction.users, currentUser];

						return {
							...m,
							reactions: existingReactions.map((item) =>
								item.name === name ? { ...item, users, count: users.length } : item
							)
						};
					}

					return {
						...m,
						reactions: [
							...existingReactions,
							{
								name,
								users: [currentUser],
								count: 1
							}
						]
					};
				}

				return m;
			});

			try {
				await addReaction(getAuthToken(), message.channel_id, message.id, name);
			} catch (error) {
				toast.error(`${error}`);
			}
		}
	};

	const loadMoreMessages = async () => {
		// scroll slightly down to disable continuous loading
		const element = document.getElementById('messages-container');
		if (element) {
			element.scrollTop = element.scrollTop + 100;
		}

		messagesLoading = true;

		await onLoad();

		await tick();
		messagesLoading = false;
	};
</script>

{#if messages}
	{@const messageList = messages.slice().reverse()}
	<div>
		{#if !top}
			<Loader
				on:visible={() => {
					console.info('visible');
					if (!messagesLoading) {
						loadMoreMessages();
					}
				}}
			>
				<div class="w-full flex justify-center py-1 text-xs animate-pulse items-center gap-2">
					<Spinner className=" size-4" />
					<div class=" ">{$i18n.t('Loading...')}</div>
				</div>
			</Loader>
		{:else if !thread}
			<div class="px-5 max-w-full mx-auto">
				{#if channel}
					{@const channelUsers = channel.users ?? []}
					<div class="flex flex-col gap-1.5 pb-5 pt-10">
						{#if channel?.type === 'dm'}
							<div class="flex ml-[1px] mr-0.5">
								{#each channelUsers.filter((u) => u.id !== $user?.id).slice(0, 2) as u, index}
									<img
										src={`${WEBUI_API_BASE_URL}/users/${u.id}/profile/image`}
										alt={u.name}
										class=" size-7.5 rounded-full border-2 border-white dark:border-gray-900 {index ===
										1
											? '-ml-2.5'
											: ''}"
									/>
								{/each}
							</div>
						{/if}

						<div class="text-2xl font-medium capitalize">
							{#if channel?.name}
								{channel.name}
							{:else}
								{channelUsers
									.filter((u) => u.id !== $user?.id)
									.map((u) => u.name)
									.join(', ')}
							{/if}
						</div>

						<div class=" text-gray-500">
							{$i18n.t(
								'This channel was created on {{createdAt}}. This is the very beginning of the {{channelName}} channel.',
								{
									createdAt: channel.created_at
										? dayjs(channel.created_at / 1000000).format('MMMM D, YYYY')
										: '',
									channelName: channel.name
								}
							)}
						</div>
					</div>
				{:else}
					<div class="flex justify-center text-xs items-center gap-2 py-5">
						<div class=" ">{$i18n.t('Start of the channel')}</div>
					</div>
				{/if}

				{#if messageList.length > 0}
					<hr class=" border-gray-50 dark:border-gray-700/20 py-2.5 w-full" />
				{/if}
			</div>
		{/if}

		{#each messageList as message, messageIdx (id ? `${id}-${message.id}` : message.id)}
				<Message
					{message}
					{channel}
					{thread}
					replyToMessage={replyToMessage?.id === message.id}
					disabled={!channel?.write_access || !!message.temp_id}
					pending={Boolean(message.temp_id)}
					showUserProfile={messageIdx === 0 ||
						messageList.at(messageIdx - 1)?.user_id !== message.user_id ||
						messageList.at(messageIdx - 1)?.user?.id !== message.user?.id ||
						messageList.at(messageIdx - 1)?.meta?.model_id !== message?.meta?.model_id ||
						message?.reply_to_message !== null}
				onDelete={() => handleDelete(message)}
				onEdit={(content: string) => handleEdit(message, content)}
				onReply={onReply}
				onPin={handlePin}
				onThread={onThread}
				onReaction={(name: string) => handleReaction(message, name)}
			/>
		{/each}

		<div class="pb-6"></div>
	</div>
{/if}
