<script lang="ts">
	import { getContext } from 'svelte';
	import Message from './Message.svelte';

	const i18n = getContext('i18n');

	type PlaygroundMessage = {
		role: 'user' | 'assistant' | 'system';
		content: string;
	};

	export let messages: PlaygroundMessage[] = [];
</script>

<div class="py-3 space-y-3">
	{#each messages as message, idx}
		<Message
			{message}
			{idx}
			onDelete={() => {
				messages = messages.filter((message, messageIdx) => messageIdx !== idx);
			}}
		/>
	{/each}
</div>
