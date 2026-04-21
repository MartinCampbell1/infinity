<!-- @ts-nocheck -->
<script lang="ts">
	// @ts-nocheck
	import { getContext } from 'svelte';

	const i18n = getContext<any>('i18n');

	// TODO(21st): Replace this stopgap local panel pattern with a 21st.dev-derived micro-surface once MCP auth is fixed.

	export let active = false;
	export let taskIds: string[] | null = null;
	export let stopResponse: Function = async () => {};
	void active;

	$: visibleTaskIds = taskIds ?? [];
</script>

<div class="flex h-full min-h-0 flex-col px-2 py-2">
	<div class="flex items-center justify-between gap-2 px-2 pb-2">
		<div>
			<div class="text-sm font-medium text-slate-100">{$i18n.t('Tasks')}</div>
			<div class="text-[11px] text-slate-400">
				{$i18n.t('Current chat')} · {visibleTaskIds.length}
			</div>
		</div>

		{#if visibleTaskIds.length > 0}
			<button
				type="button"
				class="rounded-full border border-rose-500/20 bg-rose-500/12 px-2.5 py-1 text-[11px] font-medium text-rose-100 transition hover:bg-rose-500/20"
				on:click={async () => {
					await stopResponse();
				}}
			>
				{$i18n.t('Stop')}
			</button>
		{/if}
	</div>

	<div class="flex-1 min-h-0 overflow-y-auto px-1 pb-2">
		{#if visibleTaskIds.length === 0}
			<div class="px-3 py-8 text-center text-sm text-slate-400">
				{$i18n.t('No active tasks for this chat.')}
			</div>
		{:else}
			<div class="flex flex-col gap-1.5">
				{#each visibleTaskIds as taskId}
					<div
						class="rounded-xl border border-white/8 bg-slate-900/70 px-3 py-2.5"
					>
						<div class="flex items-center justify-between gap-3">
							<div class="min-w-0">
								<div
									class="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400"
								>
									{$i18n.t('Task ID')}
								</div>
								<div class="mt-1 line-clamp-1 font-mono text-xs text-slate-200">
									{taskId}
								</div>
							</div>

							<div
								class="shrink-0 rounded-full border border-emerald-500/20 bg-emerald-500/12 px-2 py-0.5 text-[11px] text-emerald-100"
							>
								{$i18n.t('Running')}
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
