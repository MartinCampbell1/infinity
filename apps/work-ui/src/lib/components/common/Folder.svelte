<!-- @ts-nocheck -->
<script lang="ts">
	// @ts-nocheck
	import { createEventDispatcher, onDestroy, onMount } from 'svelte';

	const dispatch = createEventDispatcher();

	export let open = true;
	export let id = '';
	export let name = '';
	export let collapsible = true;
	export let className = '';
	export let buttonClassName = '';
	export let chevron = true;
	export let onAddLabel = '';
	export let onAdd: null | (() => void | Promise<void>) = null;
	export let dragAndDrop = true;

	let rootElement: HTMLDivElement | null = null;
	let draggedOver = false;

	const persistKey = () => (id ? `${id}-folder-state` : '');

	const toggleOpen = () => {
		open = !open;
		dispatch('change', open);
		if (persistKey()) {
			localStorage.setItem(persistKey(), `${open}`);
		}
	};

	const handleDragOver = (event: DragEvent) => {
		if (!dragAndDrop) return;
		event.preventDefault();
		draggedOver = true;
	};

	const handleDragLeave = () => {
		draggedOver = false;
	};

	const handleDrop = (event: DragEvent) => {
		if (!dragAndDrop) return;
		event.preventDefault();
		draggedOver = false;

		const transfer = event.dataTransfer;
		if (!transfer) return;

		const text = transfer.getData('text/plain');
		if (text) {
			try {
				dispatch('drop', JSON.parse(text));
				open = true;
				return;
			} catch {
				// Ignore malformed drag payloads.
			}
		}

		const file = Array.from(transfer.files ?? []).find((item) => item.type === 'application/json');
		if (!file) return;

		const reader = new FileReader();
		reader.onload = () => {
			try {
				dispatch('import', JSON.parse(String(reader.result ?? '')));
				open = true;
			} catch {
				// Ignore malformed imports.
			}
		};
		reader.readAsText(file);
	};

	onMount(() => {
		if (id) {
			const stored = localStorage.getItem(persistKey());
			if (stored !== null) {
				open = stored === 'true';
			}
		}

		rootElement?.addEventListener('dragover', handleDragOver);
		rootElement?.addEventListener('dragleave', handleDragLeave);
		rootElement?.addEventListener('drop', handleDrop);
	});

	onDestroy(() => {
		rootElement?.removeEventListener('dragover', handleDragOver);
		rootElement?.removeEventListener('dragleave', handleDragLeave);
		rootElement?.removeEventListener('drop', handleDrop);
	});
</script>

<div bind:this={rootElement} class={`relative ${className}`}>
	{#if draggedOver}
		<div class="pointer-events-none absolute inset-0 z-10 rounded-xl bg-gray-100/40 dark:bg-gray-800/20"></div>
	{/if}

	{#if collapsible}
		<div class={`group relative w-full rounded-xl ${buttonClassName}`}>
			<button
				type="button"
				class="flex w-full items-center justify-between rounded-xl px-2 py-1.5 text-left text-xs font-medium text-gray-700 transition hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-900"
				on:click={toggleOpen}
			>
				<span class="flex items-center gap-1.5">
					{#if chevron}
						<span class="text-[10px] leading-none text-gray-500">{open ? '▾' : '▸'}</span>
					{/if}
					<span>{name}</span>
				</span>
			</button>

			{#if onAdd}
				<button
					type="button"
					class="absolute right-2 top-1.5 rounded-md px-1.5 py-0.5 text-[11px] text-gray-500 opacity-0 transition group-hover:opacity-100 dark:text-gray-300"
					aria-label={onAddLabel || 'Add item'}
					on:click|stopPropagation={() => onAdd?.()}
				>
					{onAddLabel || '+'}
				</button>
			{/if}

			{#if open}
				<div class="w-full">
					<slot />
				</div>
			{/if}
		</div>
	{:else}
		<slot />
	{/if}
</div>
