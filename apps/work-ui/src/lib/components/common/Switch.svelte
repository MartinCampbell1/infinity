<!-- @ts-nocheck -->
<script lang="ts">
	// @ts-nocheck
	import { createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher();

	export let id: string | undefined = undefined;
	export let state = false;
	export let disabled = false;
	export let className = '';
	export let ariaLabel = 'Toggle switch';
	export let ariaLabelledbyId: string | undefined = undefined;
	export let tooltip = false;

	const toggle = () => {
		if (disabled) return;
		state = !state;
		dispatch('change', state);
	};
</script>

<button
	{id}
	type="button"
	aria-pressed={state}
	disabled={disabled}
	class={`inline-flex h-6 w-11 items-center rounded-full border border-transparent transition ${
		state ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-700'
	} ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} ${className}`}
	aria-label={ariaLabel}
	aria-labelledby={ariaLabelledbyId}
	data-tooltip={tooltip ? 'true' : 'false'}
	on:click={toggle}
>
	<span
		aria-hidden="true"
		class={`inline-block size-5 rounded-full bg-white shadow transition ${
			state ? 'translate-x-5' : 'translate-x-0.5'
		}`}
	></span>
</button>
