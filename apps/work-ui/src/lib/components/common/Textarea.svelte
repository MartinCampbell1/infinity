<!-- @ts-nocheck -->
<script lang="ts">
	// @ts-nocheck
	export let value = '';
	export let className = '';
	export let placeholder = '';
	export let readonly = false;
	export let maxSize: number | null = null;
	export let minSize: number | null = null;
	export let ariaLabel = '';
	export let rows: number | undefined = undefined;
	export let required = false;
	export let disabled = false;
	export let onFocus: ((event: FocusEvent) => void) | undefined = undefined;
	export let onKeydown: ((event: KeyboardEvent) => void) | undefined = undefined;
</script>

<textarea
	class={className}
	{placeholder}
	{readonly}
	{rows}
	{required}
	{disabled}
	aria-label={ariaLabel}
	bind:value
	maxlength={maxSize ?? undefined}
	minlength={minSize ?? undefined}
	on:focus={onFocus}
	on:keydown={onKeydown}
></textarea>
