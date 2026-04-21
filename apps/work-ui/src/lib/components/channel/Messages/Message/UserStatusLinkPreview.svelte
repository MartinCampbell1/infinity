<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { LinkPreview } from 'bits-ui';

	const i18n = getContext('i18n');
	import { getUserInfoById } from '$lib/apis/users';
	import type { ChannelUserRecord } from './user-status-types';

	import UserStatus from './UserStatus.svelte';

	export let id: string | null = null;

	export let side: 'top' | 'left' | 'right' | 'bottom' = 'top';
	export let align: 'start' | 'center' | 'end' = 'start';
	export let sideOffset = 6;

	let user: ChannelUserRecord | null = null;
	onMount(async () => {
		if (id) {
			user = (await getUserInfoById(localStorage.token, id).catch((error) => {
				console.error('Error fetching user by ID:', error);
				return null;
			})) as ChannelUserRecord | null;
		}
	});
</script>

{#if user}
	<LinkPreview.Portal>
		<LinkPreview.Content
			class="w-[260px] rounded-2xl border border-gray-100  dark:border-gray-800 z-[9999] bg-white dark:bg-gray-850 dark:text-white shadow-lg transition"
			{side}
			{align}
			{sideOffset}
		>
			<UserStatus {user} />
		</LinkPreview.Content>
	</LinkPreview.Portal>
{/if}
