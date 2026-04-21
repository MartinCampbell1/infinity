<script lang="ts">
	import Switch from '$lib/components/common/Switch.svelte';
	import Textarea from '$lib/components/common/Textarea.svelte';
	import Tooltip from '$lib/components/common/Tooltip.svelte';
	import EllipsisVertical from '$lib/components/icons/EllipsisVertical.svelte';
	import XMark from '$lib/components/icons/XMark.svelte';
	import Sortable from 'sortablejs';
	import { getContext } from 'svelte';
	import type { Banner } from '$lib/types';
	const i18n = getContext('i18n');

	export let banners: Banner[] = [];

	let sortable: Sortable | null = null;
	let bannerListElement: HTMLDivElement | null = null;

	const positionChangeHandler = (): void => {
		if (!bannerListElement) return;

		const bannerIdOrder = Array.from(bannerListElement.children)
			.map((child) => (child as HTMLElement).id.replace('banner-item-', ''))
			.filter(Boolean);

		// Sort the banners array based on the new order.
		banners = bannerIdOrder
			.map((id) => banners.find((banner) => banner.id === id))
			.filter((banner): banner is Banner => banner !== undefined);
	};

	$: if (banners) {
		init();
	}

	const init = (): void => {
		if (sortable) {
			sortable.destroy();
		}

		if (bannerListElement) {
			sortable = new Sortable(bannerListElement, {
				animation: 150,
				handle: '.item-handle',
				onUpdate: () => {
					positionChangeHandler();
				}
			});
		}
	};
</script>

<div class=" flex flex-col gap-3 {banners?.length > 0 ? 'mt-2' : ''}" bind:this={bannerListElement}>
	{#each banners as banner, bannerIdx (banner.id)}
		<div class=" flex justify-between items-start -ml-1" id="banner-item-{banner.id}">
			<EllipsisVertical className="size-4 cursor-move item-handle" />

			<div class="flex flex-row flex-1 gap-2 items-start">
				<select
					class="w-fit capitalize rounded-xl text-xs bg-transparent outline-hidden pl-1 pr-5"
					bind:value={banner.type}
					required
				>
					<option value="" disabled hidden class="text-gray-900">{$i18n.t('Type')}</option>
					<option value="info" class="text-gray-900">{$i18n.t('Info')}</option>
					<option value="warning" class="text-gray-900">{$i18n.t('Warning')}</option>
					<option value="error" class="text-gray-900">{$i18n.t('Error')}</option>
					<option value="success" class="text-gray-900">{$i18n.t('Success')}</option>
				</select>

				<Textarea
					className="mr-2 text-xs w-full bg-transparent outline-hidden resize-none"
					placeholder={$i18n.t('Content')}
					bind:value={banner.content}
					maxSize={100}
				/>

				<div class="relative -left-2">
					<Tooltip content={$i18n.t('Remember Dismissal')} className="flex h-fit items-center">
						<Switch bind:state={banner.dismissible} />
					</Tooltip>
				</div>
			</div>

			<button
				class="pr-3"
				type="button"
				on:click={() => {
					banners.splice(bannerIdx, 1);
					banners = banners;
				}}
			>
				<XMark className={'size-4'} />
			</button>
		</div>
	{/each}
</div>
