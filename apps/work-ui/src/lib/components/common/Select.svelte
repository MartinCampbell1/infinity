<script lang="ts">
	import { flyAndScale } from '$lib/utils/transitions';
	import { tick } from 'svelte';

	type SelectOptionValue = string | null;
	type SelectItem = {
		value: SelectOptionValue;
		label: string;
	};

	/** Currently selected value */
	export let value: SelectOptionValue = '';

	/** Items array: { value: string, label: string }[] */
	export let items: SelectItem[] = [];

	/** Placeholder text when no value is selected */
	export let placeholder = '';

	/** Callback when value changes */
	export let onChange: (value: SelectOptionValue) => void = () => {};

	/** CSS classes for the trigger button */
	export let triggerClass = '';

	/** CSS classes for the label inside the trigger */
	export let labelClass = '';

	/** CSS classes for the dropdown content container */
	export let contentClass =
		'rounded-2xl min-w-[170px] p-1 border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-850 dark:text-white shadow-lg';

	/** CSS classes for each item button */
	export let itemClass =
		'flex w-full gap-2 items-center px-3 py-1.5 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl';

	/** Alignment of the dropdown: 'start' | 'end' */
	export let align: 'start' | 'center' | 'end' = 'start';

	/** Callback when dropdown closes */
	export let onClose: () => void = () => {};

	export let open = false;

	let triggerEl: HTMLButtonElement | null = null;
	let contentEl: HTMLDivElement | null = null;

	$: selectedLabel = items.find((i) => i.value === value)?.label ?? placeholder;

	/** Svelte action: moves the node to document.body (portal) */
	function portal(node: HTMLDivElement) {
		document.body.appendChild(node);
		return {
			destroy() {
				if (node.parentNode) {
					node.parentNode.removeChild(node);
				}
			}
		};
	}

	function positionContent() {
		if (!triggerEl || !contentEl) return;
		const rect = triggerEl.getBoundingClientRect();

		contentEl.style.position = 'fixed';
		contentEl.style.zIndex = '9999';
		contentEl.style.top = `${rect.bottom + 4}px`;
		contentEl.style.minWidth = `${rect.width}px`;

		if (align === 'end') {
			contentEl.style.right = `${window.innerWidth - rect.right}px`;
			contentEl.style.left = 'auto';
		} else {
			contentEl.style.left = `${rect.left}px`;
			contentEl.style.right = 'auto';
		}
	}

	async function toggleOpen() {
		open = !open;
		if (open) {
			await tick();
			positionContent();
		}
	}

	function handleWindowClick(event: MouseEvent) {
		const target = event.target as Node | null;
		if (!open) return;
		if (triggerEl?.contains(target)) return;
		if (contentEl?.contains(target)) return;
		open = false;
		onClose();
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && open) {
			open = false;
			onClose();
		}
	}

	export function selectItem(item: SelectItem) {
		value = item.value;
		open = false;
		onChange(value);
	}
</script>

<svelte:window
	on:click={handleWindowClick}
	on:keydown={handleKeydown}
	on:scroll|capture={positionContent}
	on:resize={positionContent}
/>

<button
	bind:this={triggerEl}
	class={triggerClass}
	aria-label={placeholder}
	type="button"
	on:click={toggleOpen}
>
	<slot name="trigger" {selectedLabel} {open}>
		<span class={labelClass}>
			{selectedLabel}
		</span>
	</slot>
</button>

{#if open}
	<div use:portal bind:this={contentEl} class={contentClass} transition:flyAndScale>
		<slot {open} {selectItem}>
			{#each items as item}
				<button class={itemClass} type="button" on:click={() => selectItem(item)}>
					<slot name="item" {item} selected={value === item.value}>
						{item.label}
					</slot>
				</button>
			{/each}
		</slot>
	</div>
{/if}
