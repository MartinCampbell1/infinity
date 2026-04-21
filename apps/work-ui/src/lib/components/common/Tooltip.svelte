<!-- @ts-nocheck -->
<script lang="ts">
	// @ts-nocheck
	export let content: string = '';
	export let className: string = '';
	export let placement:
		| 'top'
		| 'top-start'
		| 'top-end'
		| 'right'
		| 'right-start'
		| 'right-end'
		| 'bottom'
		| 'bottom-start'
		| 'bottom-end'
		| 'left'
		| 'left-start'
		| 'left-end' = 'top';
</script>

<span class={`relative inline-flex ${className}`} title={content} data-placement={placement}>
	<slot />
</span>
