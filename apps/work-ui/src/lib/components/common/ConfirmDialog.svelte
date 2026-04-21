<!-- @ts-nocheck -->
<script lang="ts">
	// @ts-nocheck
	import { createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher();

	export let title = '';
	export let message = '';
	export let cancelLabel = 'Cancel';
	export let confirmLabel = 'Confirm';
	export let input = false;
	export let inputPlaceholder = '';
	export let inputValue = '';
	export let inputType = 'text';
	export let show = false;

	let localValue = inputValue;

	$: if (show) {
		localValue = inputValue;
	}

	const close = (kind: 'confirm' | 'cancel' | 'dismiss') => {
		if (kind !== 'confirm') {
			show = false;
		}

		if (kind === 'confirm') {
			show = false;
			dispatch('confirm', localValue);
			return;
		}

		dispatch(kind);
	};
</script>

{#if show}
	<div
		class="fixed inset-0 z-[999999] flex items-center justify-center bg-black/60 px-4"
		role="button"
		tabindex="0"
		on:click={(event) => {
			if (event.target === event.currentTarget) {
				close('dismiss');
			}
		}}
		on:keydown={(event) => {
			if (event.key === 'Enter' || event.key === ' ' || event.key === 'Escape') {
				event.preventDefault();
				close('dismiss');
			}
		}}
	>
			<div
				class="w-full max-w-xl rounded-3xl border border-white/10 bg-white p-6 text-gray-900 shadow-2xl dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100"
				role="dialog"
				tabindex="-1"
				aria-modal="true"
				aria-label={title || 'Confirm dialog'}
			>
			<div class="text-lg font-medium">{title || 'Confirm your action'}</div>
			<div class="mt-2 text-sm text-gray-600 dark:text-gray-300">
				{#if message}
					{message}
				{:else}
					This action cannot be undone. Do you wish to continue?
				{/if}
			</div>

			{#if input}
				<div class="mt-4">
					{#if inputType === 'password'}
						<input
							bind:value={localValue}
							placeholder={inputPlaceholder || 'Enter your message'}
							type="password"
							class="w-full rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm outline-none transition focus:border-gray-400 dark:border-gray-800 dark:bg-gray-900"
						/>
					{:else}
						<textarea
							bind:value={localValue}
							placeholder={inputPlaceholder || 'Enter your message'}
							class="min-h-24 w-full resize-none rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm outline-none transition focus:border-gray-400 dark:border-gray-800 dark:bg-gray-900"
						></textarea>
					{/if}
				</div>
			{/if}

			<div class="mt-6 flex gap-3">
				<button
					class="flex-1 rounded-full bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-200 dark:bg-gray-850 dark:text-gray-200 dark:hover:bg-gray-800"
					on:click={() => close('cancel')}
				>
					{cancelLabel}
				</button>
				<button
					class="flex-1 rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
					on:click={() => close('confirm')}
				>
					{confirmLabel}
				</button>
			</div>
		</div>
	</div>
{/if}
