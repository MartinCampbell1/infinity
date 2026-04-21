<script lang="ts">
	import { goto } from '$app/navigation';

	import { socket, user } from '$lib/stores';

	import { getChannelThreadMessages, sendMessage } from '$lib/apis/channels';

	import XMark from '$lib/components/icons/XMark.svelte';
	import MessageInput from './MessageInput.svelte';
	import Messages from './Messages.svelte';
	import { onDestroy, onMount, tick, getContext } from 'svelte';
	import { toast } from 'svelte-sonner';
	import Spinner from '../common/Spinner.svelte';

	const i18n = getContext('i18n');

	type ChannelParticipant = {
		id: string;
		name: string;
	};

	type ChannelState = {
		id: string;
		type?: string;
		name?: string;
		write_access?: boolean;
		users?: ChannelParticipant[];
		[key: string]: unknown;
	} | null;

	type ChannelReactionUser = {
		id: string;
		name?: string | null;
		[key: string]: unknown;
	};

	type ChannelReaction = {
		name: string;
		users: ChannelReactionUser[];
		count: number;
	};

	type ChannelMessage = {
		id: string;
		channel_id: string;
		parent_id?: string | null;
		user: {
			id: string;
			name: string;
			[key: string]: unknown;
		};
		content?: string | null;
		temp_id?: string | null;
		reply_to_message?: ChannelMessage | null;
		reactions?: ChannelReaction[] | null;
		meta?: {
			model_name?: string | null;
			[key: string]: unknown;
		};
		is_pinned?: boolean;
		pinned_by?: string | null;
		pinned_at?: number | null;
		[key: string]: unknown;
	};

	type TypingUser = {
		id: string;
		name: string;
	};

	type ChatInputElement = {
		replaceVariables: (variables: Record<string, any>) => void;
		setText: (text: string) => void;
		focus: () => void;
		getWordAtDocPos: () => string;
		replaceCommandWithText: (text: string) => void;
		insertContent: (text: string) => void;
	} | null;

	type ChannelSocketEvent = {
		channel_id: string;
		message_id: string | null;
		user: TypingUser;
		data?: {
			type?: string | null;
			data?: (ChannelMessage & { typing?: boolean }) | null;
			} | null;
	};

	type ThreadSubmitPayload = {
		content: string;
		data: {
			files: Array<Record<string, unknown>>;
		};
	};

	export let threadId: string | null = null;
	export let channel: ChannelState = null;

	export let onClose: () => void = () => {};

	let messages: ChannelMessage[] | null = null;
	let top = false;

	let messagesContainerElement: HTMLDivElement | null = null;
	let chatInputElement: ChatInputElement = null;

	let replyToMessage: ChannelMessage | null = null;

	let typingUsers: TypingUser[] = [];
	let typingUsersTimeout: Record<string, ReturnType<typeof setTimeout>> = {};

	$: if (threadId) {
		initHandler();
	}

	const scrollToBottom = () => {
		if (messagesContainerElement) {
			messagesContainerElement.scrollTop = messagesContainerElement.scrollHeight;
		}
	};

	const initHandler = async () => {
		messages = null;
		top = false;

		typingUsers = [];
		typingUsersTimeout = {};

		if (channel && threadId) {
			const currentThreadId = threadId;

			messages = (await getChannelThreadMessages(
				localStorage.token,
				channel.id,
				currentThreadId
			)) as ChannelMessage[];

			if (messages.length < 50) {
				top = true;
			}

			await tick();
			scrollToBottom();
		} else {
			goto('/');
		}
	};

	const channelEventHandler = async (event: ChannelSocketEvent) => {
		console.debug(event);
		if (event.channel_id === channel?.id && threadId) {
			const currentThreadId = threadId;
			const type = event?.data?.type ?? null;
			const data = event?.data?.data ?? null;

			if (type === 'message') {
				if (data && (data?.parent_id ?? null) === currentThreadId) {
					if (messages) {
						messages = [data, ...messages];

						if (typingUsers.find((typingUser) => typingUser.id === event.user.id)) {
							typingUsers = typingUsers.filter((typingUser) => typingUser.id !== event.user.id);
						}
					}
				}
			} else if (type === 'message:update') {
				if (messages && data) {
					const idx = messages.findIndex((message) => message.id === data.id);

					if (idx !== -1) {
						messages[idx] = data;
					}
				}
			} else if (type === 'message:delete') {
				if (!data) {
					return;
				}

				if (data.id === currentThreadId) {
					onClose();
				}

				if (messages) {
					messages = messages.filter((message) => message.id !== data.id);
				}
			} else if (type?.includes('message:reaction')) {
				if (messages && data) {
					const idx = messages.findIndex((message) => message.id === data.id);
					if (idx !== -1) {
						messages[idx] = data;
					}
				}
			} else if (type === 'typing' && event.message_id === currentThreadId) {
				if (event.user.id === $user?.id) {
					return;
				}

				typingUsers = Boolean(data?.typing)
					? [
							...typingUsers,
							...(typingUsers.find((typingUser) => typingUser.id === event.user.id)
								? []
								: [
										{
											id: event.user.id,
											name: event.user.name
										}
									])
						]
					: typingUsers.filter((typingUser) => typingUser.id !== event.user.id);

				if (typingUsersTimeout[event.user.id]) {
					clearTimeout(typingUsersTimeout[event.user.id]);
				}

				typingUsersTimeout[event.user.id] = setTimeout(() => {
					typingUsers = typingUsers.filter((typingUser) => typingUser.id !== event.user.id);
				}, 5000);
			}
		}
	};

	const submitHandler = async ({ content, data }: ThreadSubmitPayload): Promise<void> => {
		if (!channel || !threadId) {
			return;
		}

		if (!content && (data?.files ?? []).length === 0) {
			return;
		}

		const messageForm = {
			parent_id: threadId,
			content: content,
			data: data
		} as Parameters<typeof sendMessage>[2];

		if (replyToMessage?.id) {
			messageForm.reply_to_id = replyToMessage.id;
		}

		await sendMessage(localStorage.token, channel.id, messageForm).catch((error) => {
			toast.error(`${error}`);
			return null;
		});

		replyToMessage = null;
	};

	const onChange = (): void => {
		if (!channel || !threadId) {
			return;
		}

		$socket?.emit('events:channel', {
			channel_id: channel.id,
			message_id: threadId,
			data: {
				type: 'typing',
				data: {
					typing: true
				}
			}
		});
	};

	onMount(() => {
		$socket?.on('events:channel', channelEventHandler);
	});

	onDestroy(() => {
		$socket?.off('events:channel', channelEventHandler);
	});
</script>

{#if channel}
	<div class="flex flex-col w-full h-full bg-gray-50 dark:bg-gray-850">
		<div class="sticky top-0 flex items-center justify-between px-3.5 py-3">
			<div class=" font-medium text-lg">{$i18n.t('Thread')}</div>

			<div>
				<button
					class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 p-2"
					on:click={() => {
						onClose();
					}}
				>
					<XMark />
				</button>
			</div>
		</div>

		<div class=" max-h-full w-full overflow-y-auto" bind:this={messagesContainerElement}>
			{#if messages !== null}
				<Messages
					id={threadId}
					{channel}
					{top}
					{messages}
					{replyToMessage}
						thread={true}
						onReply={async (message) => {
							replyToMessage = {
								id: message.id,
								channel_id: message.channel_id,
								user: {
									id: message.user?.id ?? '',
									name: message.user?.name ?? ''
								},
								content: message.content ?? null,
								temp_id: message.temp_id ?? null,
								reply_to_message: null,
								reactions: message.reactions ?? null,
								meta: message.meta ?? undefined,
								is_pinned: message.is_pinned ?? false,
								pinned_by: message.pinned_by ?? null,
								pinned_at: message.pinned_at ?? null
							};

							await tick();
							chatInputElement?.focus();
						}}
						onLoad={async () => {
							const currentThreadId = threadId;
							const currentMessages = messages;

							if (!currentThreadId || !currentMessages) {
								return;
							}

							const newMessages = (await getChannelThreadMessages(
								localStorage.token,
								channel.id,
								currentThreadId,
								currentMessages.length
							)) as ChannelMessage[];

							messages = [...currentMessages, ...newMessages];

						if (newMessages.length < 50) {
							top = true;
							return;
						}
					}}
				/>
			{:else}
				<div class="w-full flex justify-center pt-5 pb-10">
					<Spinner />
				</div>
			{/if}

			<div class=" pb-[1rem] px-2.5 w-full">
				<MessageInput
					bind:replyToMessage
					bind:chatInputElement
					id={threadId}
					{channel}
					disabled={!channel?.write_access}
					placeholder={!channel?.write_access
						? $i18n.t('You do not have permission to send messages in this thread.')
						: $i18n.t('Reply to thread...')}
					typingUsersClassName="from-gray-50 dark:from-gray-850"
					{typingUsers}
					userSuggestions={true}
					channelSuggestions={true}
					{onChange}
					onSubmit={submitHandler}
				/>
			</div>
		</div>
	</div>
{/if}
