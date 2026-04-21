<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { Pane, PaneGroup, PaneResizer } from 'paneforge';

	import { onDestroy, onMount, tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { v4 as uuidv4 } from 'uuid';

	import {
		chatId,
		channels,
		channelId as _channelId,
		showSidebar,
		socket,
		user
	} from '$lib/stores';
	import { getChannelById, getChannelMessages, sendMessage } from '$lib/apis/channels';

	import Messages from './Messages.svelte';
	import MessageInput from './MessageInput.svelte';
	import Navbar from './Navbar.svelte';
	import Drawer from '../common/Drawer.svelte';
	import EllipsisVertical from '../icons/EllipsisVertical.svelte';
	import Thread from './Thread.svelte';
	import i18n from '$lib/i18n';
	import Spinner from '../common/Spinner.svelte';

	type ChannelParticipant = {
		id: string;
		name: string;
	};

	type ChannelState = {
		id: string;
		type?: string;
		name?: string;
		write_access?: boolean;
		unread_count?: number;
		users?: ChannelParticipant[];
		[key: string]: unknown;
	};

	type ChannelMessageData = {
		files?: unknown[];
		[key: string]: unknown;
	};

	type ChannelMessage = {
		id: string;
		channel_id: string;
		temp_id?: string | null;
		parent_id?: string | null;
		reply_to_id?: string | null;
		reply_to_message?: ChannelMessage | null;
		user_id?: string | null;
		user?: {
			id: string;
			name?: string;
			[key: string]: unknown;
		} | null;
		meta?: {
			model_id?: string | null;
			model_name?: string | null;
			[key: string]: unknown;
		} | null;
		content?: string | null;
		data?: ChannelMessageData;
		created_at?: number;
		updated_at?: number;
		is_pinned?: boolean;
		[key: string]: unknown;
	};

	type TypingUser = {
		id: string;
		name: string;
	};

	type ReplyToMessage = {
		id: string;
		channel_id: string;
		meta?: {
			model_name?: string | null;
		};
		user: {
			id: string;
			name: string;
		};
	} | null;

	type ChatInputElement = {
		replaceVariables: (variables: Record<string, any>) => void;
		setText: (text: string) => void;
		focus: () => void;
		getWordAtDocPos: () => string;
		replaceCommandWithText: (text: string) => void;
		insertContent: (text: string) => void;
	} | null;

	type ChannelTypingEventData = {
		typing: boolean;
	};

	type ChannelSocketEvent = {
		channel_id: string;
		message_id: string | null;
		user: TypingUser;
		data?: {
			type?: string | null;
			data?: ChannelMessage | ChannelTypingEventData | null;
		} | null;
	};

	type SubmitPayload = {
		content: string;
		data: ChannelMessageData;
	};

	export let id = '';

	let currentId: string | null = null;

	let scrollEnd = true;
	let messagesContainerElement: HTMLDivElement | null = null;
	let chatInputElement: ChatInputElement = null;

	let top = false;

	let channel: ChannelState | null = null;
	let messages: ChannelMessage[] | null = null;

	let replyToMessage: ReplyToMessage = null;
	let threadId: string | null = null;

	let typingUsers: TypingUser[] = [];
	let typingUsersTimeout: Record<string, ReturnType<typeof setTimeout>> = {};

	let channelTitle = 'Channel';

	$: if (id) {
		initHandler();
	}

	$: channelTitle =
		channel?.type === 'dm'
			? channel?.name?.trim() ||
				(channel?.users ?? []).reduce<string>((accumulator, participant) => {
					if (participant.id === $user?.id) {
						return accumulator;
					}

					if (accumulator) {
						return `${accumulator}, ${participant.name}`;
					}

					return participant.name;
				}, '')
			: `#${channel?.name ?? 'Channel'}`;

	const scrollToBottom = () => {
		if (messagesContainerElement) {
			messagesContainerElement.scrollTop = messagesContainerElement.scrollHeight;
		}
	};

	const setActiveChannelId = (value: string | null) => {
		(_channelId as unknown as { set: (nextValue: string | null) => void }).set(value);
	};

	const updateLastReadAt = async (channelId: string | null) => {
		if (!channelId) {
			return;
		}

		$socket?.emit('events:channel', {
			channel_id: channelId,
			message_id: null,
			data: {
				type: 'last_read_at'
			}
		});

		channels.set(
			$channels.map((channel) => {
				if (channel.id === channelId) {
					return {
						...channel,
						unread_count: 0
					};
				}
				return channel;
			})
		);
	};

	const initHandler = async () => {
		if (currentId) {
			updateLastReadAt(currentId);
		}

		currentId = id;
		updateLastReadAt(id);
		setActiveChannelId(id);

		top = false;
		messages = null;
		channel = null;
		threadId = null;

		typingUsers = [];
		typingUsersTimeout = {};

		channel = (await getChannelById(localStorage.token, id).catch((error) => {
			return null;
		})) as ChannelState | null;

		if (channel) {
			messages = (await getChannelMessages(localStorage.token, id, 0)) as ChannelMessage[] | null;

			if (messages) {
				scrollToBottom();

				if (messages.length < 50) {
					top = true;
				}
			}
		} else {
			goto('/');
		}
	};

	const channelEventHandler = async (event: ChannelSocketEvent) => {
		if (event.channel_id === id) {
			const type = event?.data?.type ?? null;
			const data = event?.data?.data ?? null;
			const currentMessages = messages ?? [];

			if (type === 'message') {
				if ((data as ChannelMessage | null)?.parent_id ?? null === null) {
					const messageData = data as ChannelMessage;
					const tempId = messageData?.temp_id ?? null;
					messages = [
						{ ...messageData, temp_id: null },
						...currentMessages.filter((message) => !tempId || message?.temp_id !== tempId)
					];

					if (typingUsers.find((typingUser) => typingUser.id === event.user.id)) {
						typingUsers = typingUsers.filter((typingUser) => typingUser.id !== event.user.id);
					}

					await tick();
					if (scrollEnd) {
						scrollToBottom();
					}
				}
			} else if (type === 'message:update') {
				const messageData = data as ChannelMessage;
				const idx = currentMessages.findIndex((message) => message.id === messageData.id);

				if (idx !== -1) {
					currentMessages[idx] = messageData;
					messages = [...currentMessages];
				}
			} else if (type === 'message:delete') {
				const messageData = data as ChannelMessage;
				messages = currentMessages.filter((message) => message.id !== messageData.id);

				if (threadId === messageData.id) {
					threadId = null;
				}
			} else if (type === 'message:reply') {
				const messageData = data as ChannelMessage;
				const idx = currentMessages.findIndex((message) => message.id === messageData.id);

				if (idx !== -1) {
					currentMessages[idx] = messageData;
					messages = [...currentMessages];
				}
			} else if (type?.includes('message:reaction')) {
				const messageData = data as ChannelMessage;
				const idx = currentMessages.findIndex((message) => message.id === messageData.id);
				if (idx !== -1) {
					currentMessages[idx] = messageData;
					messages = [...currentMessages];
				}
			} else if (type === 'typing' && event.message_id === null) {
				if (event.user.id === $user?.id) {
					return;
				}

				const typingData = data as ChannelTypingEventData;
				typingUsers = typingData.typing
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

	const submitHandler = async ({ content, data }: SubmitPayload) => {
		if (!content && (data?.files ?? []).length === 0) {
			return;
		}

		const tempId = uuidv4();

		const message = {
			channel_id: id,
			temp_id: tempId,
			content: content,
			data: data,
			reply_to_id: replyToMessage?.id ?? undefined
		};

		const ts = Date.now() * 1000000; // nanoseconds
		messages = [
			{
				...message,
				id: tempId,
				user_id: $user?.id,
				user: $user,
				reply_to_message: replyToMessage ?? null,
				created_at: ts,
				updated_at: ts
			},
			...(messages ?? [])
		];

		const res = await sendMessage(localStorage.token, id, message).catch((error) => {
			toast.error(`${error}`);
			return null;
		});

		if (res) {
			scrollToBottom();
		}

		replyToMessage = null;
	};

	const onChange = async () => {
		$socket?.emit('events:channel', {
			channel_id: id,
			message_id: null,
			data: {
				type: 'typing',
				data: {
					typing: true
				}
			}
		});

		updateLastReadAt(id);
	};

	let mediaQuery;
	let largeScreen = false;

	onMount(() => {
		if ($chatId) {
			chatId.set('');
		}

		$socket?.on('events:channel', channelEventHandler);

		mediaQuery = window.matchMedia('(min-width: 1024px)');

		const handleMediaQuery = async (e: MediaQueryList | MediaQueryListEvent) => {
			if (e.matches) {
				largeScreen = true;
			} else {
				largeScreen = false;
			}
		};

		mediaQuery.addEventListener('change', handleMediaQuery);
		handleMediaQuery(mediaQuery);
	});

	onDestroy(() => {
		// last read at
		updateLastReadAt(id);
		setActiveChannelId(null);
		$socket?.off('events:channel', channelEventHandler);
	});
</script>

<svelte:head>
	{#if channel?.type === 'dm'}
		<title>{channelTitle} • Open WebUI</title>
	{:else}
		<title>{channelTitle} • Open WebUI</title>
	{/if}
</svelte:head>

<div
	class="h-screen max-h-[100dvh] transition-width duration-200 ease-in-out {$showSidebar
		? 'md:max-w-[calc(100%-var(--sidebar-width))]'
		: ''} w-full max-w-full flex flex-col"
	id="channel-container"
>
	<PaneGroup direction="horizontal" class="w-full h-full">
		<Pane defaultSize={50} minSize={50} class="h-full flex flex-col w-full relative">
			<Navbar
				{channel}
				onPin={(messageId: string, pinned: boolean) => {
					messages = (messages ?? []).map((message) => {
						if (message.id === messageId) {
							return {
								...message,
								is_pinned: pinned
							};
						}
						return message;
					});
				}}
				onUpdate={async () => {
					channel = await getChannelById(localStorage.token, id).catch((error) => {
						return null;
					});
				}}
			/>

			{#if channel && messages !== null}
				<div class="flex-1 overflow-y-auto">
					<div
						class=" pb-2.5 max-w-full z-10 scrollbar-hidden w-full h-full pt-6 flex-1 flex flex-col-reverse overflow-auto"
						id="messages-container"
						bind:this={messagesContainerElement}
						on:scroll={() => {
							scrollEnd = Math.abs(messagesContainerElement?.scrollTop ?? 0) <= 50;
						}}
					>
						{#key id}
							<Messages
								{channel}
								{top}
								{messages}
								{replyToMessage}
								onReply={async (message) => {
									replyToMessage = {
										id: message.id,
										channel_id: message.channel_id,
										meta: {
											model_name: message.meta?.model_name ?? null
										},
										user: {
											id: message.user?.id ?? '',
											name: message.user?.name ?? ''
										}
									};
									await tick();
									chatInputElement?.focus();
								}}
								onThread={(messageId: string) => {
									threadId = messageId;
								}}
								onLoad={async () => {
									const newMessages = await getChannelMessages(
										localStorage.token,
										id,
										(messages ?? []).length
									);

									messages = [...(messages ?? []), ...((newMessages ?? []) as ChannelMessage[])];

									if ((newMessages ?? []).length < 50) {
										top = true;
										return;
									}
								}}
							/>
						{/key}
					</div>
				</div>

				<div class=" pb-[1rem] px-2.5">
					<MessageInput
						id="root"
						bind:chatInputElement
						bind:replyToMessage
						{typingUsers}
						{channel}
						userSuggestions={true}
						channelSuggestions={true}
						disabled={!channel?.write_access}
						placeholder={!channel?.write_access
							? $i18n.t('You do not have permission to send messages in this channel.')
							: $i18n.t('Type here...')}
						{onChange}
						onSubmit={submitHandler}
						{scrollToBottom}
						{scrollEnd}
					/>
				</div>
			{:else}
				<div class=" flex items-center justify-center h-full w-full">
					<div class="m-auto">
						<Spinner className="size-5" />
					</div>
				</div>
			{/if}
		</Pane>

		{#if !largeScreen}
			{#if threadId !== null}
				<Drawer
					show={threadId !== null}
					onClose={() => {
						threadId = null;
					}}
				>
					<div class=" {threadId !== null ? ' h-screen  w-full' : 'px-6 py-4'} h-full">
						<Thread
							{threadId}
							{channel}
							onClose={() => {
								threadId = null;
							}}
						/>
					</div>
				</Drawer>
			{/if}
		{:else if threadId !== null}
			<PaneResizer
				class="relative flex items-center justify-center group border-l border-gray-50 dark:border-gray-850/30 hover:border-gray-200 dark:hover:border-gray-800  transition z-20"
				id="controls-resizer"
			>
				<div
					class=" absolute -left-1.5 -right-1.5 -top-0 -bottom-0 z-20 cursor-col-resize bg-transparent"
				></div>
			</PaneResizer>

			<Pane defaultSize={50} minSize={30} class="h-full w-full">
				<div class="h-full w-full shadow-xl">
					<Thread
						{threadId}
						{channel}
						onClose={() => {
							threadId = null;
						}}
					/>
				</div>
			</Pane>
		{/if}
	</PaneGroup>
</div>
