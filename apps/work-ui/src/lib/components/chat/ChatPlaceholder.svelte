<script lang="ts">
	import { WEBUI_API_BASE_URL } from '$lib/constants';
	import { marked } from 'marked';

	import { config, user, models as _models, temporaryChatEnabled } from '$lib/stores';
	import type { Model } from '$lib/stores';
	import { onMount, getContext } from 'svelte';

	import { fade } from 'svelte/transition';

	import Suggestions from './Suggestions.svelte';
	import { sanitizeResponseContent } from '$lib/utils';
	import Tooltip from '$lib/components/common/Tooltip.svelte';
	import EyeSlash from '$lib/components/icons/EyeSlash.svelte';

	const i18n = getContext('i18n');

	type SuggestionPrompt = {
		id?: string;
		content: string;
		title?: [string, string] | string[] | null;
	};

	type ChatModel = Model & {
		info?: {
			meta?: {
				description?: string | null;
				suggestion_prompts?: SuggestionPrompt[] | null;
				user?: ChatModelUser | null;
			} | null;
		} | null;
	};

	type ChatModelUser = {
		community?: boolean;
		name?: string | null;
		username?: string | null;
	};

	type SuggestionSelectEvent = {
		type: 'prompt';
		data: string;
	};

	export let modelIds: string[] = [];
	export let models: ChatModel[] = [];
	export let atSelectedModel: ChatModel | null = null;

	export let onSelect: (e: SuggestionSelectEvent) => void = () => {};

	let mounted = false;
	let selectedModelIdx = 0;
	let selectedModel: ChatModel | null = null;
	let selectedModelDescription = '';
	let selectedModelUser: ChatModelUser | null = null;

	$: if (modelIds.length > 0) {
		selectedModelIdx = Math.max(models.length - 1, 0);
	}

	$: models = modelIds.flatMap((id) => {
		const model = $_models.find((candidate) => candidate.id === id);
		return model ? [model as ChatModel] : [];
	});
	$: selectedModel = models[selectedModelIdx] ?? null;
	$: selectedModelDescription = selectedModel?.info?.meta?.description ?? '';
	$: selectedModelUser = selectedModel?.info?.meta?.user ?? null;

	onMount(() => {
		mounted = true;
	});

	const handleImageError = (event: Event) => {
		const image = event.currentTarget as HTMLImageElement | null;

		if (image) {
			image.src = '/favicon.png';
		}
	};

	const getCommunityProfileHref = (username?: string | null) => {
		return username ? `https://openwebui.com/m/${username}` : 'https://openwebui.com/';
	};
</script>

{#key mounted}
	<div class="m-auto w-full max-w-6xl px-8 lg:px-20">
		<div class="flex justify-start">
			<div class="flex -space-x-4 mb-0.5" in:fade={{ duration: 200 }}>
				{#each models as model, modelIdx}
					<button
						on:click={() => {
							selectedModelIdx = modelIdx;
						}}
					>
							<Tooltip
								content={marked.parse(
									sanitizeResponseContent(selectedModelDescription).replaceAll('\n', '<br>')
								)}
								placement="right"
							>
							<img
								src={`${WEBUI_API_BASE_URL}/models/model/profile/image?id=${model?.id}&lang=${$i18n.language}`}
								class=" size-[2.7rem] rounded-full border-[1px] border-gray-100 dark:border-none"
								alt="logo"
								draggable="false"
								on:error={handleImageError}
							/>
						</Tooltip>
					</button>
				{/each}
			</div>
		</div>

		{#if $temporaryChatEnabled}
			<Tooltip
				content={$i18n.t("This chat won't appear in history and your messages will not be saved.")}
				className="w-full flex justify-start mb-0.5"
				placement="top"
			>
				<div class="flex items-center gap-2 text-gray-500 text-lg mt-2 w-fit">
					<EyeSlash strokeWidth="2.5" className="size-5" />{$i18n.t('Temporary Chat')}
				</div>
			</Tooltip>
		{/if}

		<div
			class=" mt-2 mb-4 text-3xl text-gray-800 dark:text-gray-100 text-left flex items-center gap-4 font-primary"
		>
			<div>
					<div class=" capitalize line-clamp-1" in:fade={{ duration: 200 }}>
						{#if selectedModel?.name}
							{selectedModel.name}
						{:else}
							{$i18n.t('Hello, {{name}}', { name: $user?.name })}
						{/if}
					</div>

					<div in:fade={{ duration: 200, delay: 200 }}>
						{#if selectedModelDescription}
							<div
								class="mt-0.5 text-base font-normal text-gray-500 dark:text-gray-400 line-clamp-3 markdown"
							>
								{@html marked.parse(sanitizeResponseContent(selectedModelDescription).replaceAll('\n', '<br>'))}
							</div>
							{#if selectedModelUser}
								<div class="mt-0.5 text-sm font-normal text-gray-400 dark:text-gray-500">
									By
									{#if selectedModelUser.community}
										<a
											href={getCommunityProfileHref(selectedModelUser.username)}
											>{selectedModelUser.name
												? selectedModelUser.name
												: `@${selectedModelUser.username ?? ''}`}</a
										>
									{:else}
										{selectedModelUser.name}
									{/if}
								</div>
							{/if}
					{:else}
						<div class=" text-gray-400 dark:text-gray-500 line-clamp-1 font-p">
							{$i18n.t('How can I help you today?')}
						</div>
					{/if}
				</div>
			</div>
		</div>

		<div class=" w-full font-primary" in:fade={{ duration: 200, delay: 300 }}>
				<Suggestions
					className="grid grid-cols-2"
					suggestionPrompts={atSelectedModel?.info?.meta?.suggestion_prompts ??
						selectedModel?.info?.meta?.suggestion_prompts ??
						$config?.default_prompt_suggestions ??
						[]}
					{onSelect}
			/>
		</div>
	</div>
{/key}
