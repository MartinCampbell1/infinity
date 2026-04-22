<script>
	import {
		addTagById,
		deleteTagById,
		getAllTags,
		getChatList,
		getChatListByTagName,
		getTagsById,
		updateChatById
	} from '$lib/apis/chats';
	import {
		tags as _tags,
		chats,
		pinnedChats,
		currentChatPage,
		scrollPaginationEnabled
	} from '$lib/stores';
	import { createEventDispatcher, onMount } from 'svelte';
	import { resolveFounderosEmbeddedAccessToken } from '$lib/founderos/credentials';

	const dispatch = createEventDispatcher();

	import Tags from '../common/Tags.svelte';
	import { toast } from 'svelte-sonner';

	export let chatId = '';
	export let disabled = false;
	let tags = [];
	const getWorkspaceAuthToken = () => resolveFounderosEmbeddedAccessToken();

	const getTags = async () => {
		return await getTagsById(getWorkspaceAuthToken(), chatId).catch(async (error) => {
			return [];
		});
	};

	const addTag = async (tagName) => {
		const res = await addTagById(getWorkspaceAuthToken(), chatId, tagName).catch(async (error) => {
			toast.error(`${error}`);
			return null;
		});
		if (!res) {
			return;
		}

		tags = await getTags();
		await updateChatById(getWorkspaceAuthToken(), chatId, {
			tags: tags
		});

		await _tags.set(await getAllTags(getWorkspaceAuthToken()));
		dispatch('add', {
			name: tagName
		});
	};

	const deleteTag = async (tagName) => {
		const res = await deleteTagById(getWorkspaceAuthToken(), chatId, tagName);
		tags = await getTags();
		await updateChatById(getWorkspaceAuthToken(), chatId, {
			tags: tags
		});

		await _tags.set(await getAllTags(getWorkspaceAuthToken()));
		dispatch('delete', {
			name: tagName
		});
	};

	onMount(async () => {
		if (chatId) {
			tags = await getTags();
		}
	});
</script>

<Tags
	{tags}
	{disabled}
	suggestionTags={$_tags ?? []}
	on:delete={(e) => {
		deleteTag(e.detail);
	}}
	on:add={(e) => {
		addTag(e.detail);
	}}
/>
