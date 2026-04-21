<script lang="ts">
	import dayjs from 'dayjs';
	import { onMount, tick, getContext } from 'svelte';
	import { createEventDispatcher } from 'svelte';

	import { mobile, models, settings } from '$lib/stores';

	import { generateMoACompletion } from '$lib/apis';
	import { updateChatById } from '$lib/apis/chats';
	import { createOpenAITextStream } from '$lib/apis/streaming';

	import ResponseMessage from './ResponseMessage.svelte';
	import Tooltip from '$lib/components/common/Tooltip.svelte';
	import Merge from '$lib/components/icons/Merge.svelte';

	import Markdown from './Markdown.svelte';
	import Name from './Name.svelte';
	import Skeleton from './Skeleton.svelte';
	import localizedFormat from 'dayjs/plugin/localizedFormat';
	import ProfileImage from './ProfileImage.svelte';
	import { WEBUI_BASE_URL } from '$lib/constants';
	import type {
		ChatMessage,
		MessageGroupIndexMap,
		MessageGroupMap,
		MessageHistory
	} from './types';
	const i18n = getContext('i18n');
	dayjs.extend(localizedFormat);

	export let chatId;
	export let history: MessageHistory = { messages: {}, currentId: null };
	export let messageId: string = '';
	export let selectedModels: unknown[] = [];

	export let isLastMessage;
	export let readOnly = false;
	export let editCodeBlock = true;

	export let setInputText: Function = () => {};
	export let updateChat: Function;
	export let editMessage: Function;
	export let saveMessage: Function;
	export let rateMessage: Function;
	export let actionMessage: Function;

	export let submitMessage: Function;
	export let deleteMessage: Function;

	export let continueResponse: Function;
	export let regenerateResponse: Function;
	export let mergeResponses: Function;

	export let addMessages: Function;
	export let respondToApproval: Function = () => {};

	export let triggerScroll: Function;

	export let topPadding = false;

	const dispatch = createEventDispatcher();

	let currentMessageId: string | null = null;
	let parentMessage: ChatMessage | null = null;
	let groupedMessageIds: MessageGroupMap = {};
	let groupedMessageIdsIdx: MessageGroupIndexMap = {};

	let selectedModelIdx: number | null = null;
	let displayMultiModelResponsesInTabs = false;

	let message: ChatMessage | null = history.messages[messageId]
		? structuredClone(history.messages[messageId])
		: null;
	$: if (history.messages) {
		const source = history.messages[messageId];
		if (source) {
			if (!message || message.content !== source.content || message.done !== source.done) {
				message = structuredClone(source);
			} else if (JSON.stringify(message) !== JSON.stringify(source)) {
				message = structuredClone(source);
			}
		}
	}

	$: displayMultiModelResponsesInTabs = Boolean(
		($settings as { displayMultiModelResponsesInTabs?: boolean } | null)?.displayMultiModelResponsesInTabs
	);

	const getBranchTailMessageId = (startMessageId: string) => {
		let tailMessageId = startMessageId;
		let tailChildrenIds = history.messages[tailMessageId]?.childrenIds ?? [];

		while (tailChildrenIds.length !== 0) {
			const nextMessageId = tailChildrenIds[tailChildrenIds.length - 1];
			if (!nextMessageId) {
				break;
			}

			tailMessageId = nextMessageId;
			tailChildrenIds = history.messages[tailMessageId]?.childrenIds ?? [];
		}

		return tailMessageId;
	};

	const gotoMessage = async (modelIdx: number, messageIdx: number) => {
		// Clamp messageIdx to ensure it's within valid range
		groupedMessageIdsIdx[modelIdx] = Math.max(
			0,
			Math.min(messageIdx, groupedMessageIds[modelIdx].messageIds.length - 1)
		);

		// Get the messageId at the specified index
		let messageId = groupedMessageIds[modelIdx].messageIds[groupedMessageIdsIdx[modelIdx]];
		console.log(messageId);

		messageId = getBranchTailMessageId(messageId);

		// Update the current message ID in history
		history.currentId = messageId;

		// Await UI updates
		await tick();
		await updateChat();

		// Trigger scrolling after navigation
		triggerScroll();
	};

	const showPreviousMessage = async (modelIdx: number) => {
		groupedMessageIdsIdx[modelIdx] = Math.max(0, groupedMessageIdsIdx[modelIdx] - 1);

		let messageId = groupedMessageIds[modelIdx].messageIds[groupedMessageIdsIdx[modelIdx]];
		console.log(messageId);

		messageId = getBranchTailMessageId(messageId);

		history.currentId = messageId;

		await tick();
		await updateChat();
		triggerScroll();
	};

	const showNextMessage = async (modelIdx: number) => {
		groupedMessageIdsIdx[modelIdx] = Math.min(
			groupedMessageIds[modelIdx].messageIds.length - 1,
			groupedMessageIdsIdx[modelIdx] + 1
		);

		let messageId = groupedMessageIds[modelIdx].messageIds[groupedMessageIdsIdx[modelIdx]];
		console.log(messageId);

		messageId = getBranchTailMessageId(messageId);

		history.currentId = messageId;

		await tick();
		await updateChat();
		triggerScroll();
	};

	const initHandler = async () => {
		console.log('multiresponse:initHandler');
		await tick();

		currentMessageId = messageId;
		const currentMessage = history.messages[messageId];
		parentMessage = currentMessage?.parentId ? history.messages[currentMessage.parentId] ?? null : null;

		const parentModels = parentMessage?.models ?? [];
		const parentChildrenIds = parentMessage?.childrenIds ?? [];

		groupedMessageIds = parentModels.reduce<MessageGroupMap>((a, model, modelIdx) => {
			// Find all messages that are children of the parent message and have the same model
			let modelMessageIds = parentChildrenIds
				.map((id) => history.messages[id])
				.filter((m) => m?.modelIdx === modelIdx)
				.map((m) => m.id);

			// Legacy support for messages that don't have a modelIdx
			// Find all messages that are children of the parent message and have the same model
			if (modelMessageIds.length === 0) {
				let modelMessages = parentChildrenIds
					.map((id) => history.messages[id])
					.filter((m): m is ChatMessage => m?.model === model);

				modelMessages.forEach((m) => {
					m.modelIdx = modelIdx;
				});

				modelMessageIds = modelMessages.map((m) => m.id);
			}

			return {
				...a,
				[modelIdx]: { messageIds: modelMessageIds }
			};
		}, {});

		groupedMessageIdsIdx = parentModels.reduce<MessageGroupIndexMap>((a, model, modelIdx) => {
			const idx = groupedMessageIds[modelIdx].messageIds.findIndex((id) => id === messageId);
			if (idx !== -1) {
				return {
					...a,
					[modelIdx]: idx
				};
			} else {
				return {
					...a,
					[modelIdx]: groupedMessageIds[modelIdx].messageIds.length - 1
				};
			}
		}, {});

		selectedModelIdx = history.messages[messageId]?.modelIdx ?? null;

		console.log(groupedMessageIds, groupedMessageIdsIdx);

		await tick();
	};

	const onGroupClick = async (_messageId: string, modelIdx: number) => {
		if (messageId != _messageId) {
			history.currentId = getBranchTailMessageId(_messageId);
			selectedModelIdx = modelIdx;

			// await tick();
			// await updateChat();
			// triggerScroll();
		}
	};

	const mergeResponsesHandler = async () => {
		const responses = Object.keys(groupedMessageIds).map((modelIdx: string) => {
			const { messageIds } = groupedMessageIds[modelIdx];
			const messageId = messageIds[groupedMessageIdsIdx[modelIdx]];

			return history.messages[messageId].content;
		});
		mergeResponses(messageId, responses, chatId);
	};

	const handleGotoMessage = (modelIdx: number) => (_message: unknown, messageIdx: number) => {
		return gotoMessage(modelIdx, messageIdx);
	};

	const handleShowPreviousMessage = (modelIdx: number) => () => {
		return showPreviousMessage(modelIdx);
	};

	const handleShowNextMessage = (modelIdx: number) => () => {
		return showNextMessage(modelIdx);
	};

	const handleRegenerateResponse =
		(modelIdx: number) =>
		async (message: ChatMessage, prompt: string | null = null) => {
			regenerateResponse(message, prompt);
			await tick();
			groupedMessageIdsIdx[String(modelIdx)] =
				groupedMessageIds[String(modelIdx)].messageIds.length - 1;
		};

	onMount(async () => {
		await initHandler();
		await tick();

		if ($settings?.scrollOnBranchChange ?? true) {
			const messageElement = document.getElementById(`message-${messageId}`);
			if (messageElement) {
				messageElement.scrollIntoView({ block: 'start' });
			}
		}
	});
</script>

{#if parentMessage}
	<div>
		<div
			class="flex snap-x snap-mandatory overflow-x-auto scrollbar-hidden"
			id="responses-container-{chatId}-{parentMessage.id}"
		>
		{#if displayMultiModelResponsesInTabs}
				<div class="w-full">
					<div class=" flex w-full mb-4.5 border-b border-gray-200 dark:border-gray-850">
						<div
							class="flex gap-2 scrollbar-none overflow-x-auto w-fit text-center font-medium bg-transparent pt-1 text-sm"
							on:wheel|preventDefault={(e) => {
								e.currentTarget.scrollLeft += e.deltaY;
							}}
						>
							{#each Object.keys(groupedMessageIds) as modelIdx}
								{#if groupedMessageIdsIdx[modelIdx] !== undefined && (groupedMessageIds[modelIdx]?.messageIds ?? []).length > 0}
									<!-- svelte-ignore a11y-no-static-element-interactions -->
									<!-- svelte-ignore a11y-click-events-have-key-events -->

									{@const _messageId =
										groupedMessageIds[modelIdx].messageIds[groupedMessageIdsIdx[modelIdx]]}

									{@const model = $models.find((m) => m.id === history.messages[_messageId]?.model)}

									<button
										class="min-w-fit {selectedModelIdx === Number(modelIdx)
											? ' dark:border-gray-300 '
											: ' opacity-35 border-transparent'} pb-1.5 px-2.5 transition border-b-2"
										on:click={async () => {
											if (selectedModelIdx !== Number(modelIdx)) {
												selectedModelIdx = Number(modelIdx);
											}

											onGroupClick(_messageId, Number(modelIdx));
										}}
									>
										<div class="flex items-center gap-1.5">
											<div class="-translate-y-[1px]">
												{model ? `${model.name}` : history.messages[_messageId]?.model}
											</div>
										</div>
									</button>
								{/if}
							{/each}
						</div>
					</div>

					{#if selectedModelIdx !== null}
						{#key history.currentId}
							{#if message}
								<ResponseMessage
									{chatId}
									{history}
									messageId={message?.id}
									{selectedModels}
									isLastMessage={true}
									siblings={groupedMessageIds[String(selectedModelIdx)].messageIds}
									gotoMessage={handleGotoMessage(selectedModelIdx ?? 0)}
									showPreviousMessage={handleShowPreviousMessage(selectedModelIdx ?? 0)}
									showNextMessage={handleShowNextMessage(selectedModelIdx ?? 0)}
									{setInputText}
									{updateChat}
									{editMessage}
									{saveMessage}
									{rateMessage}
									{deleteMessage}
									{actionMessage}
									{submitMessage}
									{continueResponse}
									regenerateResponse={handleRegenerateResponse(selectedModelIdx ?? 0)}
									{addMessages}
									{respondToApproval}
									{readOnly}
									{topPadding}
								/>
							{/if}
						{/key}
					{/if}
				</div>
			{:else}
				{#each Object.keys(groupedMessageIds) as modelIdx}
					{#if groupedMessageIdsIdx[modelIdx] !== undefined && groupedMessageIds[modelIdx].messageIds.length > 0}
						<!-- svelte-ignore a11y-no-static-element-interactions -->
						<!-- svelte-ignore a11y-click-events-have-key-events -->
						{@const _messageId =
							groupedMessageIds[modelIdx].messageIds[groupedMessageIdsIdx[modelIdx]]}

						<!-- svelte-ignore a11y-no-static-element-interactions -->
						<!-- svelte-ignore a11y-click-events-have-key-events -->
						<div
							class=" snap-center w-full max-w-full m-1 border {Number(
								history.messages[messageId]?.modelIdx ?? -1
							) === Number(modelIdx)
								? `bg-gray-50 dark:bg-gray-850 border-gray-100 dark:border-gray-800 border-2 ${
										$mobile ? 'min-w-full' : 'min-w-80'
									}`
								: `border-gray-100/30 dark:border-gray-850/30 border-dashed ${
										$mobile ? 'min-w-full' : 'min-w-80'
									}`} transition-all p-5 rounded-2xl"
								on:click={async () => {
									onGroupClick(_messageId, Number(modelIdx));
								}}
						>
							{#key history.currentId}
								{#if message}
									<ResponseMessage
										{chatId}
										{history}
									messageId={_messageId}
									{selectedModels}
									isLastMessage={true}
									siblings={groupedMessageIds[String(modelIdx)].messageIds}
									gotoMessage={handleGotoMessage(Number(modelIdx))}
									showPreviousMessage={handleShowPreviousMessage(Number(modelIdx))}
									showNextMessage={handleShowNextMessage(Number(modelIdx))}
									{setInputText}
									{updateChat}
									{editMessage}
										{saveMessage}
										{rateMessage}
										{deleteMessage}
										{actionMessage}
									{submitMessage}
									{continueResponse}
									regenerateResponse={handleRegenerateResponse(Number(modelIdx))}
									{addMessages}
									{respondToApproval}
									{readOnly}
									{editCodeBlock}
									{topPadding}
									/>
								{/if}
							{/key}
						</div>
					{/if}
				{/each}
			{/if}
		</div>

		{#if !readOnly}
				{#if !Object.keys(groupedMessageIds).find((modelIdx) => {
					const { messageIds } = groupedMessageIds[modelIdx];
					const _messageId = messageIds[groupedMessageIdsIdx[modelIdx]];
					return !(history.messages[_messageId]?.done ?? false);
				})}
				<div class="flex justify-end">
					<div class="w-full">
							{#if history.messages[messageId]?.merged?.status}
								{@const mergedMessage = history.messages[messageId]?.merged}
								{@const mergedTimestamp = Number(mergedMessage?.timestamp ?? 0)}

								<div class="w-full rounded-xl pl-5 pr-2 py-2 mt-2">
									<Name>
										{$i18n.t('Merged Response')}

										{#if mergedTimestamp > 0}
											<span
												class=" self-center invisible group-hover:visible text-gray-400 text-xs font-medium uppercase ml-0.5 -mt-0.5"
											>
												{dayjs(mergedTimestamp * 1000).format('LT')}
											</span>
										{/if}
									</Name>

									<div class="mt-1 markdown-prose w-full min-w-full">
										{#if (mergedMessage?.content ?? '') === ''}
											<Skeleton />
										{:else}
											<Markdown id={`merged`} content={mergedMessage?.content ?? ''} />
										{/if}
									</div>
								</div>
						{/if}
					</div>

					{#if isLastMessage}
						<div class=" shrink-0 text-gray-600 dark:text-gray-500 mt-1">
							<Tooltip content={$i18n.t('Merge Responses')} placement="bottom">
								<button
									type="button"
									id="merge-response-button"
									class="{true
										? 'visible'
										: 'invisible group-hover:visible'} p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg dark:hover:text-white hover:text-black transition"
									on:click={() => {
										mergeResponsesHandler();
									}}
								>
									<Merge className=" size-5 " />
								</button>
							</Tooltip>
						</div>
					{/if}
				</div>
			{/if}
		{/if}
	</div>
{/if}
