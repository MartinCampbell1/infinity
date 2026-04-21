<script lang="ts">
	import { getContext } from 'svelte';
	import Checkbox from '$lib/components/common/Checkbox.svelte';
	import Tooltip from '$lib/components/common/Tooltip.svelte';
	import { marked } from 'marked';

	const i18n = getContext('i18n');

	const capabilityKeys = [
		'vision',
		'file_upload',
		'file_context',
		'web_search',
		'image_generation',
		'code_interpreter',
		'usage',
		'citations',
		'status_updates',
		'builtin_tools'
	] as const;

	type CapabilityKey = (typeof capabilityKeys)[number];

	const capabilityLabels: Record<CapabilityKey, { label: string; description: string }> = {
		vision: {
			label: $i18n.t('Vision'),
			description: $i18n.t('Model accepts image inputs')
		},
		file_upload: {
			label: $i18n.t('File Upload'),
			description: $i18n.t('Model accepts file inputs')
		},
		file_context: {
			label: $i18n.t('File Context'),
			description: $i18n.t('Inject file content into conversation context')
		},
		web_search: {
			label: $i18n.t('Web Search'),
			description: $i18n.t('Model can search the web for information')
		},
		image_generation: {
			label: $i18n.t('Image Generation'),
			description: $i18n.t('Model can generate images based on text prompts')
		},
		code_interpreter: {
			label: $i18n.t('Code Interpreter'),
			description: $i18n.t('Model can execute code and perform calculations')
		},
		usage: {
			label: $i18n.t('Usage'),
			description: $i18n.t(
				'Sends `stream_options: { include_usage: true }` in the request.\nSupported providers will return token usage information in the response when set.'
			)
		},
		citations: {
			label: $i18n.t('Citations'),
			description: $i18n.t('Displays citations in the response')
		},
		status_updates: {
			label: $i18n.t('Status Updates'),
			description: $i18n.t('Displays status updates (e.g., web search progress) in the response')
		},
		builtin_tools: {
			label: $i18n.t('Builtin Tools'),
			description: $i18n.t(
				'Automatically inject system tools in native function calling mode (e.g., timestamps, memory, chat history, notes, etc.)'
			)
		}
	};

	export let capabilities: Partial<Record<CapabilityKey, boolean>> = {};

	let visibleCapabilities: CapabilityKey[] = [];

	$: visibleCapabilities = capabilityKeys.filter((cap) => {
		if (cap === 'file_context' && !capabilities.file_upload) {
			return false;
		}
		return true;
	});

	// Hide file_context when file_upload is disabled
</script>

<div>
	<div class="flex w-full justify-between mb-1">
		<div class=" self-center text-xs font-medium text-gray-500">{$i18n.t('Capabilities')}</div>
	</div>
	<div class="flex items-center mt-2 flex-wrap">
		{#each visibleCapabilities as capability}
			<div class=" flex items-center gap-2 mr-3">
				<Checkbox
					state={capabilities[capability] ? 'checked' : 'unchecked'}
					on:change={(e) => {
						capabilities[capability] = e.detail === 'checked';
					}}
				/>

				<div class=" py-0.5 text-sm capitalize">
					<Tooltip content={marked.parse(capabilityLabels[capability].description)}>
						{$i18n.t(capabilityLabels[capability].label)}
					</Tooltip>
				</div>
			</div>
		{/each}
	</div>
</div>
