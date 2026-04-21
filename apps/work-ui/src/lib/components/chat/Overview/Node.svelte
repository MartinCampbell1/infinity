<script lang="ts">
	import { WEBUI_API_BASE_URL } from '$lib/constants';
	import { Handle, Position } from '@xyflow/svelte';
	import { getContext } from 'svelte';

	import ProfileImage from '../Messages/ProfileImage.svelte';
	import Tooltip from '$lib/components/common/Tooltip.svelte';
	import Heart from '$lib/components/icons/Heart.svelte';

	const i18n = getContext('i18n');

	type OverviewMessageError = {
		content?: string | null;
	};

	type OverviewMessage = {
		role?: string | null;
		content?: string | null;
		error?: OverviewMessageError | null;
		model?: string | null;
		favorite?: boolean;
	};

	type OverviewUser = {
		id?: string | null;
		name?: string | null;
	};

	type OverviewModel = {
		id?: string | null;
		name?: string | null;
	};

	type OverviewNodeData = {
		user?: OverviewUser | null;
		message?: OverviewMessage | null;
		model?: OverviewModel | null;
	};

	export let data: OverviewNodeData = {};

	let message: OverviewMessage = {};
	let user: OverviewUser | null = null;
	let model: OverviewModel | null = null;
	let messageContent = '';

	$: message = data?.message ?? {};
	$: user = data?.user ?? null;
	$: model = data?.model ?? null;
	$: messageContent = message.error?.content ?? message.content ?? '';
</script>

<div
	class="px-4 py-3 shadow-md rounded-xl dark:bg-black bg-white border border-gray-100 dark:border-gray-900 w-60 h-20 group"
>
	<Tooltip
		content={messageContent}
		className="w-full"
	>
		{#if message.role === 'user'}
			<div class="flex w-full">
				<ProfileImage
					src={`${WEBUI_API_BASE_URL}/users/${user?.id ?? ''}/profile/image`}
					className={'size-5 -translate-y-[1px] flex-shrink-0'}
				/>
				<div class="ml-2">
					<div class=" flex justify-between items-center">
						<div class="text-xs text-black dark:text-white font-medium line-clamp-1">
							{user?.name ?? 'User'}
						</div>
					</div>

					{#if message.error}
						<div class="text-red-500 line-clamp-2 text-xs mt-0.5">{message.error.content}</div>
					{:else}
						<div class="text-gray-500 line-clamp-2 text-xs mt-0.5">{message.content}</div>
					{/if}
				</div>
			</div>
		{:else}
			<div class="flex w-full">
				<ProfileImage
					src={`${WEBUI_API_BASE_URL}/models/model/profile/image?id=${model?.id ?? message.model ?? ''}&lang=${$i18n.language}`}
					className={'size-5 -translate-y-[1px] flex-shrink-0'}
				/>

				<div class="ml-2">
					<div class=" flex justify-between items-center">
						<div class="text-xs text-black dark:text-white font-medium line-clamp-1">
							{model?.name ?? message.model ?? 'Assistant'}
						</div>

						<button
							class={message.favorite ? '' : 'invisible group-hover:visible'}
							aria-label={message.favorite
								? $i18n.t('Remove from favorites')
								: $i18n.t('Add to favorites')}
							on:click={() => {
								message.favorite = !(message.favorite ?? false);
							}}
						>
							<Heart
								className="size-3 {message.favorite
									? 'fill-red-500 stroke-red-500'
									: 'hover:fill-red-500 hover:stroke-red-500'} "
								strokeWidth="2.5"
							/>
						</button>
					</div>

					{#if message.error}
						<div class="text-red-500 line-clamp-2 text-xs mt-0.5">
							{message.error.content}
						</div>
					{:else}
						<div class="text-gray-500 line-clamp-2 text-xs mt-0.5">{message.content}</div>
					{/if}
				</div>
			</div>
		{/if}
	</Tooltip>
	<Handle type="target" position={Position.Top} class="w-2 rounded-full dark:bg-gray-900" />
	<Handle type="source" position={Position.Bottom} class="w-2 rounded-full dark:bg-gray-900" />
</div>
