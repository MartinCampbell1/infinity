<script lang="ts">
	import HermesWorkspaceHeader from '$lib/components/hermes/workspace/HermesWorkspaceHeader.svelte';
	import { founderosLaunchContext } from '$lib/founderos';

	export let title = '';
	export let subtitle = '';
	export let badge = '';
	export let metaItems: string[] = [];
	export let maxWidthClass = 'max-w-5xl';
</script>

<div class="flex h-full min-h-0 bg-[#08101f] text-slate-100">
	<section class="flex min-w-0 flex-1 flex-col bg-slate-950/70">
		{#if !$founderosLaunchContext.embedded}
			<HermesWorkspaceHeader
				label="Embedded workspace"
				{title}
				{subtitle}
				{badge}
				{metaItems}
				compact={true}
			/>
		{/if}

		<div class={`mx-auto flex w-full ${maxWidthClass} flex-1 flex-col gap-5 px-5 py-5`}>
			{#if $founderosLaunchContext.embedded}
				<div class="space-y-0.5">
					<div class="text-[15px] font-semibold tracking-[-0.02em] text-slate-100">
						{title}
					</div>
					{#if subtitle}
						<div class="text-[12px] leading-5 text-slate-400">
							{subtitle}
						</div>
					{/if}
				</div>
			{/if}
			<slot />
		</div>
	</section>
</div>
