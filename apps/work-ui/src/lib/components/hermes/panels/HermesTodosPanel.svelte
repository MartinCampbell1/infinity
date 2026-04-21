<!-- @ts-nocheck -->
<script lang="ts">
	// @ts-nocheck
	import { getContext } from 'svelte';

	const i18n = getContext<any>('i18n');

	// TODO(21st): Replace this stopgap local panel pattern with a 21st.dev-derived micro-surface once MCP auth is fixed.

	export let active = false;
	export let history = {};
	void active;

	const taskLineRegex = /^[\s>*-]*[-*]\s+\[([ xX])\]\s+(.+)$/gm;

	const extractTodos = (messages: Record<string, any>): any[] => {
		if (!messages) return [];

		return (Object.values(messages) as any[]).flatMap((message: any) => {
			if (!message?.content || typeof message.content !== 'string') {
				return [];
			}

			const matches = Array.from(message.content.matchAll(taskLineRegex)) as RegExpMatchArray[];
			return matches.map((match: RegExpMatchArray, index) => ({
				id: `${message.id}-${index}`,
				checked: match[1].toLowerCase() === 'x',
				text: match[2].trim(),
				role: message.role
			}));
		});
	};

	let todoItems: any[] = [];
	let openCount = 0;

	$: todoItems = extractTodos((history as any)?.messages ?? {});
	$: openCount = todoItems.filter((item) => !item.checked).length;
</script>

<div class="flex h-full min-h-0 flex-col px-2 py-2">
	<div class="flex items-center justify-between gap-2 px-2 pb-2">
		<div>
			<div class="text-sm font-medium text-slate-100">{$i18n.t('Todos')}</div>
			<div class="text-[11px] text-slate-400">
				{$i18n.t('{{COUNT}} open items', { COUNT: openCount })}
			</div>
		</div>
	</div>

	<div class="flex-1 min-h-0 overflow-y-auto px-1 pb-2">
		{#if todoItems.length === 0}
			<div class="px-3 py-8 text-center text-sm text-slate-400">
				{$i18n.t('No checklist items found in this chat.')}
			</div>
		{:else}
			<div class="flex flex-col gap-1.5">
				{#each todoItems as item (item.id)}
					<div
						class="rounded-xl border border-white/8 bg-slate-900/70 px-3 py-2.5"
					>
						<div class="flex items-start gap-2.5">
							<div class="mt-0.5 shrink-0">
								<div
									class="flex size-4 items-center justify-center rounded border border-white/12"
								>
									{#if item.checked}
										<div class="size-2 rounded-sm bg-slate-200"></div>
									{/if}
								</div>
							</div>

							<div class="min-w-0 flex-1">
								<div
									class="text-sm leading-6 {item.checked
										? 'text-slate-500 line-through'
										: 'text-slate-100'}"
								>
									{item.text}
								</div>
								<div class="mt-1 text-[11px] text-slate-400">
									{$i18n.t(item.role === 'assistant' ? 'From assistant' : 'From user')}
								</div>
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
