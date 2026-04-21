<script lang="ts">
	import { getRAGConfig, updateRAGConfig } from '$lib/apis/retrieval';
	import Switch from '$lib/components/common/Switch.svelte';

	import { onMount, getContext } from 'svelte';
	import SensitiveInput from '$lib/components/common/SensitiveInput.svelte';
	import Tooltip from '$lib/components/common/Tooltip.svelte';
	import Textarea from '$lib/components/common/Textarea.svelte';

	type WebConfig = {
		ENABLE_WEB_SEARCH: boolean;
		WEB_SEARCH_ENGINE: string;
		OLLAMA_CLOUD_WEB_SEARCH_API_KEY: string;
		PERPLEXITY_SEARCH_API_URL: string;
		PERPLEXITY_API_KEY: string;
		SEARXNG_QUERY_URL: string;
		SEARXNG_LANGUAGE: string;
		YACY_QUERY_URL: string;
		YACY_USERNAME: string;
		YACY_PASSWORD: string;
		GOOGLE_PSE_API_KEY: string;
		GOOGLE_PSE_ENGINE_ID: string;
		BRAVE_SEARCH_API_KEY: string;
		KAGI_SEARCH_API_KEY: string;
		MOJEEK_SEARCH_API_KEY: string;
		BOCHA_SEARCH_API_KEY: string;
		SERPSTACK_API_KEY: string;
		SERPER_API_KEY: string;
		SERPLY_API_KEY: string;
		TAVILY_API_KEY: string;
		SEARCHAPI_API_KEY: string;
		SEARCHAPI_ENGINE: string;
		SERPAPI_API_KEY: string;
		SERPAPI_ENGINE: string;
		JINA_API_BASE_URL: string;
		JINA_API_KEY: string;
		BING_SEARCH_V7_ENDPOINT: string;
		BING_SEARCH_V7_SUBSCRIPTION_KEY: string;
		EXA_API_KEY: string;
		PERPLEXITY_MODEL: string;
		PERPLEXITY_SEARCH_CONTEXT_USAGE: 'low' | 'medium' | 'high' | '';
		SOUGOU_API_SID: string;
		SOUGOU_API_SK: string;
		FIRECRAWL_API_BASE_URL: string;
		FIRECRAWL_API_KEY: string;
		FIRECRAWL_TIMEOUT: number;
		EXTERNAL_WEB_SEARCH_URL: string;
		EXTERNAL_WEB_SEARCH_API_KEY: string;
		YANDEX_WEB_SEARCH_URL: string;
		YANDEX_WEB_SEARCH_API_KEY: string;
		YANDEX_WEB_SEARCH_CONFIG: string;
		YOUCOM_API_KEY: string;
		DDGS_BACKEND: string;
		WEB_SEARCH_RESULT_COUNT: string;
		WEB_SEARCH_CONCURRENT_REQUESTS: number;
		WEB_FETCH_MAX_CONTENT_LENGTH: number;
		WEB_SEARCH_DOMAIN_FILTER_LIST: string;
		BYPASS_WEB_SEARCH_EMBEDDING_AND_RETRIEVAL: boolean;
		BYPASS_WEB_SEARCH_WEB_LOADER: boolean;
		WEB_SEARCH_TRUST_ENV: boolean;
		WEB_LOADER_ENGINE: string;
		WEB_LOADER_TIMEOUT: string;
		ENABLE_WEB_LOADER_SSL_VERIFICATION: boolean;
		PLAYWRIGHT_WS_URL: string;
		PLAYWRIGHT_TIMEOUT: string;
		TAVILY_EXTRACT_DEPTH: string;
		EXTERNAL_WEB_LOADER_URL: string;
		EXTERNAL_WEB_LOADER_API_KEY: string;
		WEB_LOADER_CONCURRENT_REQUESTS: string;
		YOUTUBE_LOADER_LANGUAGE: string;
		YOUTUBE_LOADER_PROXY_URL: string;
	};
	type RawWebConfig = Partial<Record<keyof WebConfig, unknown>> & Record<string, unknown>;
	type RAGConfigPayload = Parameters<typeof updateRAGConfig>[1];

	const i18n = getContext('i18n');

	export let saveHandler: () => void | Promise<void> = async () => {};

	let webSearchEngines = [
		'ollama_cloud',
		'perplexity_search',
		'searxng',
		'yacy',
		'google_pse',
		'brave',
		'kagi',
		'mojeek',
		'bocha',
		'serpstack',
		'serper',
		'serply',
		'searchapi',
		'serpapi',
		'duckduckgo',
		'tavily',
		'jina',
		'bing',
		'exa',
		'perplexity',
		'sougou',
		'firecrawl',
		'external',
		'yandex',
		'youcom'
	];
	let webLoaderEngines = ['playwright', 'firecrawl', 'tavily', 'external'];

	let webConfig: WebConfig | null = null;

	const toStringValue = (value: unknown, fallback = ''): string => {
		if (typeof value === 'string') {
			return value;
		}

		if (typeof value === 'number' && Number.isFinite(value)) {
			return `${value}`;
		}

		return fallback;
	};

	const toBooleanValue = (value: unknown, fallback = false): boolean => {
		return typeof value === 'boolean' ? value : fallback;
	};

	const toNumberValue = (value: unknown, fallback = 0): number => {
		if (typeof value === 'number' && Number.isFinite(value)) {
			return value;
		}

		if (typeof value === 'string' && value.trim() !== '') {
			const parsed = Number(value);
			if (Number.isFinite(parsed)) {
				return parsed;
			}
		}

		return fallback;
	};

	const toCommaSeparatedValue = (value: unknown): string => {
		if (Array.isArray(value)) {
			return value
				.filter((item): item is string => typeof item === 'string')
				.join(',');
		}

		return toStringValue(value);
	};

	const splitCommaSeparatedValue = (value: string): string[] =>
		value
			.split(',')
			.map((item) => item.trim())
			.filter((item) => item.length > 0);

	const normalizeWebConfig = (raw: RawWebConfig): WebConfig => ({
		ENABLE_WEB_SEARCH: toBooleanValue(raw.ENABLE_WEB_SEARCH),
		WEB_SEARCH_ENGINE: toStringValue(raw.WEB_SEARCH_ENGINE),
		OLLAMA_CLOUD_WEB_SEARCH_API_KEY: toStringValue(raw.OLLAMA_CLOUD_WEB_SEARCH_API_KEY),
		PERPLEXITY_SEARCH_API_URL: toStringValue(raw.PERPLEXITY_SEARCH_API_URL),
		PERPLEXITY_API_KEY: toStringValue(raw.PERPLEXITY_API_KEY),
		SEARXNG_QUERY_URL: toStringValue(raw.SEARXNG_QUERY_URL),
		SEARXNG_LANGUAGE: toStringValue(raw.SEARXNG_LANGUAGE),
		YACY_QUERY_URL: toStringValue(raw.YACY_QUERY_URL),
		YACY_USERNAME: toStringValue(raw.YACY_USERNAME),
		YACY_PASSWORD: toStringValue(raw.YACY_PASSWORD),
		GOOGLE_PSE_API_KEY: toStringValue(raw.GOOGLE_PSE_API_KEY),
		GOOGLE_PSE_ENGINE_ID: toStringValue(raw.GOOGLE_PSE_ENGINE_ID),
		BRAVE_SEARCH_API_KEY: toStringValue(raw.BRAVE_SEARCH_API_KEY),
		KAGI_SEARCH_API_KEY: toStringValue(raw.KAGI_SEARCH_API_KEY),
		MOJEEK_SEARCH_API_KEY: toStringValue(raw.MOJEEK_SEARCH_API_KEY),
		BOCHA_SEARCH_API_KEY: toStringValue(raw.BOCHA_SEARCH_API_KEY),
		SERPSTACK_API_KEY: toStringValue(raw.SERPSTACK_API_KEY),
		SERPER_API_KEY: toStringValue(raw.SERPER_API_KEY),
		SERPLY_API_KEY: toStringValue(raw.SERPLY_API_KEY),
		TAVILY_API_KEY: toStringValue(raw.TAVILY_API_KEY),
		SEARCHAPI_API_KEY: toStringValue(raw.SEARCHAPI_API_KEY),
		SEARCHAPI_ENGINE: toStringValue(raw.SEARCHAPI_ENGINE),
		SERPAPI_API_KEY: toStringValue(raw.SERPAPI_API_KEY),
		SERPAPI_ENGINE: toStringValue(raw.SERPAPI_ENGINE),
		JINA_API_BASE_URL: toStringValue(raw.JINA_API_BASE_URL),
		JINA_API_KEY: toStringValue(raw.JINA_API_KEY),
		BING_SEARCH_V7_ENDPOINT: toStringValue(raw.BING_SEARCH_V7_ENDPOINT),
		BING_SEARCH_V7_SUBSCRIPTION_KEY: toStringValue(raw.BING_SEARCH_V7_SUBSCRIPTION_KEY),
		EXA_API_KEY: toStringValue(raw.EXA_API_KEY),
		PERPLEXITY_MODEL: toStringValue(raw.PERPLEXITY_MODEL),
		PERPLEXITY_SEARCH_CONTEXT_USAGE:
			toStringValue(raw.PERPLEXITY_SEARCH_CONTEXT_USAGE) === 'low' ||
			toStringValue(raw.PERPLEXITY_SEARCH_CONTEXT_USAGE) === 'medium' ||
			toStringValue(raw.PERPLEXITY_SEARCH_CONTEXT_USAGE) === 'high'
				? (toStringValue(raw.PERPLEXITY_SEARCH_CONTEXT_USAGE) as WebConfig['PERPLEXITY_SEARCH_CONTEXT_USAGE'])
				: '',
		SOUGOU_API_SID: toStringValue(raw.SOUGOU_API_SID),
		SOUGOU_API_SK: toStringValue(raw.SOUGOU_API_SK),
		FIRECRAWL_API_BASE_URL: toStringValue(raw.FIRECRAWL_API_BASE_URL),
		FIRECRAWL_API_KEY: toStringValue(raw.FIRECRAWL_API_KEY),
		FIRECRAWL_TIMEOUT: toNumberValue(raw.FIRECRAWL_TIMEOUT),
		EXTERNAL_WEB_SEARCH_URL: toStringValue(raw.EXTERNAL_WEB_SEARCH_URL),
		EXTERNAL_WEB_SEARCH_API_KEY: toStringValue(raw.EXTERNAL_WEB_SEARCH_API_KEY),
		YANDEX_WEB_SEARCH_URL: toStringValue(raw.YANDEX_WEB_SEARCH_URL),
		YANDEX_WEB_SEARCH_API_KEY: toStringValue(raw.YANDEX_WEB_SEARCH_API_KEY),
		YANDEX_WEB_SEARCH_CONFIG: toStringValue(raw.YANDEX_WEB_SEARCH_CONFIG),
		YOUCOM_API_KEY: toStringValue(raw.YOUCOM_API_KEY),
		DDGS_BACKEND: toStringValue(raw.DDGS_BACKEND),
		WEB_SEARCH_RESULT_COUNT: toStringValue(raw.WEB_SEARCH_RESULT_COUNT),
		WEB_SEARCH_CONCURRENT_REQUESTS: toNumberValue(raw.WEB_SEARCH_CONCURRENT_REQUESTS),
		WEB_FETCH_MAX_CONTENT_LENGTH: toNumberValue(raw.WEB_FETCH_MAX_CONTENT_LENGTH),
		WEB_SEARCH_DOMAIN_FILTER_LIST: toCommaSeparatedValue(raw.WEB_SEARCH_DOMAIN_FILTER_LIST),
		BYPASS_WEB_SEARCH_EMBEDDING_AND_RETRIEVAL: toBooleanValue(
			raw.BYPASS_WEB_SEARCH_EMBEDDING_AND_RETRIEVAL
		),
		BYPASS_WEB_SEARCH_WEB_LOADER: toBooleanValue(raw.BYPASS_WEB_SEARCH_WEB_LOADER),
		WEB_SEARCH_TRUST_ENV: toBooleanValue(raw.WEB_SEARCH_TRUST_ENV),
		WEB_LOADER_ENGINE: toStringValue(raw.WEB_LOADER_ENGINE),
		WEB_LOADER_TIMEOUT: toStringValue(raw.WEB_LOADER_TIMEOUT),
		ENABLE_WEB_LOADER_SSL_VERIFICATION: toBooleanValue(
			raw.ENABLE_WEB_LOADER_SSL_VERIFICATION
		),
		PLAYWRIGHT_WS_URL: toStringValue(raw.PLAYWRIGHT_WS_URL),
		PLAYWRIGHT_TIMEOUT: toStringValue(raw.PLAYWRIGHT_TIMEOUT),
		TAVILY_EXTRACT_DEPTH: toStringValue(raw.TAVILY_EXTRACT_DEPTH),
		EXTERNAL_WEB_LOADER_URL: toStringValue(raw.EXTERNAL_WEB_LOADER_URL),
		EXTERNAL_WEB_LOADER_API_KEY: toStringValue(raw.EXTERNAL_WEB_LOADER_API_KEY),
		WEB_LOADER_CONCURRENT_REQUESTS: toStringValue(raw.WEB_LOADER_CONCURRENT_REQUESTS),
		YOUTUBE_LOADER_LANGUAGE: toCommaSeparatedValue(raw.YOUTUBE_LOADER_LANGUAGE),
		YOUTUBE_LOADER_PROXY_URL: toStringValue(raw.YOUTUBE_LOADER_PROXY_URL)
	});

	const buildSubmissionWebConfig = (config: WebConfig): RawWebConfig => ({
		...config,
		WEB_SEARCH_DOMAIN_FILTER_LIST: splitCommaSeparatedValue(config.WEB_SEARCH_DOMAIN_FILTER_LIST),
		YOUTUBE_LOADER_LANGUAGE: splitCommaSeparatedValue(config.YOUTUBE_LOADER_LANGUAGE),
		FIRECRAWL_TIMEOUT: `${config.FIRECRAWL_TIMEOUT}`,
		PLAYWRIGHT_TIMEOUT: config.PLAYWRIGHT_TIMEOUT
	});

	const submitHandler = async () => {
		if (!webConfig) {
			return;
		}
		const submissionWebConfig = buildSubmissionWebConfig(webConfig);

		await updateRAGConfig(localStorage.token, {
			web: submissionWebConfig
		} as unknown as RAGConfigPayload);
	};

	const loadConfig = async () => {
		const res = await getRAGConfig(localStorage.token);

		if (res) {
			webConfig = normalizeWebConfig((res.web ?? {}) as RawWebConfig);
		}
	};

	onMount(() => {
		void loadConfig();
	});
</script>

<form
	class="flex flex-col h-full justify-between space-y-3 text-sm"
	on:submit|preventDefault={async () => {
		await submitHandler();
		await saveHandler();
	}}
>
	<div class=" space-y-3 overflow-y-scroll scrollbar-hidden h-full">
		{#if webConfig}
			<div class="">
				<div class="mb-3">
					<div class=" mt-0.5 mb-2.5 text-base font-medium">{$i18n.t('General')}</div>

					<hr class=" border-gray-100/30 dark:border-gray-850/30 my-2" />

					<div class="  mb-2.5 flex w-full justify-between">
						<div class=" self-center text-xs font-medium">
							{$i18n.t('Web Search')}
						</div>
						<div class="flex items-center relative">
							<Switch bind:state={webConfig.ENABLE_WEB_SEARCH} />
						</div>
					</div>

					<div class="  mb-2.5 flex w-full justify-between">
						<div class=" self-center text-xs font-medium">
							{$i18n.t('Web Search Engine')}
						</div>
						<div class="flex items-center relative">
							<select
								class="w-fit pr-8 rounded-sm px-2 p-1 text-xs bg-transparent outline-hidden text-right"
								bind:value={webConfig.WEB_SEARCH_ENGINE}
								placeholder={$i18n.t('Select a engine')}
								required
							>
								<option disabled selected value="">{$i18n.t('Select a engine')}</option>
								{#each webSearchEngines as engine}
									{#if engine === 'duckduckgo' || engine === 'ddgs'}
										<option value={engine}>DDGS</option>
									{:else}
										<option value={engine}>{engine}</option>
									{/if}
								{/each}
							</select>
						</div>
					</div>

					{#if webConfig.WEB_SEARCH_ENGINE !== ''}
						{#if webConfig.WEB_SEARCH_ENGINE === 'ollama_cloud'}
							<div class="mb-2.5 flex w-full flex-col">
								<div>
									<div class=" self-center text-xs font-medium mb-1">
										{$i18n.t('Ollama Cloud API Key')}
									</div>

									<div class="flex w-full">
										<div class="flex-1">
											<SensitiveInput
												placeholder={$i18n.t('Enter Ollama Cloud API Key')}
												bind:value={webConfig.OLLAMA_CLOUD_WEB_SEARCH_API_KEY}
											/>
										</div>
									</div>
								</div>
							</div>
						{:else if webConfig.WEB_SEARCH_ENGINE === 'perplexity_search'}
							<div class="mb-2.5 flex w-full flex-col">
								<div>
									<div class=" self-center text-xs font-medium mb-1">
										{$i18n.t('Perplexity Search API URL')}
									</div>

									<div class="flex w-full">
										<div class="flex-1">
											<input
												class="w-full rounded-lg py-2 px-4 text-sm bg-gray-50 dark:text-gray-300 dark:bg-gray-850 outline-hidden"
												type="text"
												placeholder={$i18n.t('Enter Perplexity Search API URL')}
												bind:value={webConfig.PERPLEXITY_SEARCH_API_URL}
												autocomplete="off"
											/>
										</div>
									</div>
								</div>
							</div>

							<div class="mb-2.5 flex w-full flex-col">
								<div>
									<div class=" self-center text-xs font-medium mb-1">
										{$i18n.t('Perplexity API Key')}
									</div>

									<div class="flex w-full">
										<div class="flex-1">
											<SensitiveInput
												placeholder={$i18n.t('Enter Perplexity API Key')}
												bind:value={webConfig.PERPLEXITY_API_KEY}
											/>
										</div>
									</div>
								</div>
							</div>
						{:else if webConfig.WEB_SEARCH_ENGINE === 'searxng'}
							<div class="mb-2.5 flex w-full flex-col">
								<div>
									<div class=" self-left text-xs font-medium mb-1">
										{$i18n.t('Searxng Query URL')}
									</div>

									<div class="flex w-full">
										<div class="flex-1">
											<input
												class="w-full rounded-lg py-2 px-4 text-sm bg-gray-50 dark:text-gray-300 dark:bg-gray-850 outline-hidden"
												type="text"
												placeholder={$i18n.t('Enter Searxng Query URL')}
												bind:value={webConfig.SEARXNG_QUERY_URL}
												autocomplete="off"
												required
											/>
										</div>
									</div>
								</div>
								<div class="mb-2.5 flex w-full flex-col">
									<div class=" self-left text-xs font-medium mb-1">
										{$i18n.t('Searxng search language (all, en, es, de, fr, etc.)')}
									</div>

									<div class="flex w-full">
										<div class="flex-1">
											<input
												class="w-full rounded-lg py-2 px-4 text-sm bg-gray-50 dark:text-gray-300 dark:bg-gray-850 outline-hidden"
												type="text"
												placeholder={$i18n.t('Enter Searxng search language')}
												bind:value={webConfig.SEARXNG_LANGUAGE}
												autocomplete="off"
												required
											/>
										</div>
									</div>
								</div>
							</div>
						{:else if webConfig.WEB_SEARCH_ENGINE === 'yacy'}
							<div class="mb-2.5 flex w-full flex-col">
								<div>
									<div class=" self-center text-xs font-medium mb-1">
										{$i18n.t('Yacy Instance URL')}
									</div>

									<div class="flex w-full">
										<div class="flex-1">
											<input
												class="w-full rounded-lg py-2 px-4 text-sm bg-gray-50 dark:text-gray-300 dark:bg-gray-850 outline-hidden"
												type="text"
												placeholder={$i18n.t('Enter Yacy URL (e.g. http://yacy.example.com:8090)')}
												bind:value={webConfig.YACY_QUERY_URL}
												autocomplete="off"
											/>
										</div>
									</div>
								</div>
							</div>
							<div class="mb-2.5 flex w-full flex-col">
								<div class="flex gap-2">
									<div class="w-full">
										<div class=" self-center text-xs font-medium mb-1">
											{$i18n.t('Yacy Username')}
										</div>

										<input
											class="w-full rounded-lg py-2 px-4 text-sm bg-gray-50 dark:text-gray-300 dark:bg-gray-850 outline-hidden"
											placeholder={$i18n.t('Enter Yacy Username')}
											bind:value={webConfig.YACY_USERNAME}
											required
										/>
									</div>

									<div class="w-full">
										<div class=" self-center text-xs font-medium mb-1">
											{$i18n.t('Yacy Password')}
										</div>

										<SensitiveInput
											placeholder={$i18n.t('Enter Yacy Password')}
											bind:value={webConfig.YACY_PASSWORD}
										/>
									</div>
								</div>
							</div>
						{:else if webConfig.WEB_SEARCH_ENGINE === 'google_pse'}
							<div class="mb-2.5 flex w-full flex-col">
								<div>
									<div class=" self-center text-xs font-medium mb-1">
										{$i18n.t('Google PSE API Key')}
									</div>

									<SensitiveInput
										placeholder={$i18n.t('Enter Google PSE API Key')}
										bind:value={webConfig.GOOGLE_PSE_API_KEY}
									/>
								</div>
								<div class="mt-1.5">
									<div class=" self-center text-xs font-medium mb-1">
										{$i18n.t('Google PSE Engine Id')}
									</div>

									<div class="flex w-full">
										<div class="flex-1">
											<input
												class="w-full rounded-lg py-2 px-4 text-sm bg-gray-50 dark:text-gray-300 dark:bg-gray-850 outline-hidden"
												type="text"
												placeholder={$i18n.t('Enter Google PSE Engine Id')}
												bind:value={webConfig.GOOGLE_PSE_ENGINE_ID}
												autocomplete="off"
											/>
										</div>
									</div>
								</div>
							</div>
						{:else if webConfig.WEB_SEARCH_ENGINE === 'brave'}
							<div class="mb-2.5 flex w-full flex-col">
								<div>
									<div class=" self-center text-xs font-medium mb-1">
										{$i18n.t('Brave Search API Key')}
									</div>

									<SensitiveInput
										placeholder={$i18n.t('Enter Brave Search API Key')}
										bind:value={webConfig.BRAVE_SEARCH_API_KEY}
									/>
								</div>
							</div>
						{:else if webConfig.WEB_SEARCH_ENGINE === 'kagi'}
							<div class="mb-2.5 flex w-full flex-col">
								<div>
									<div class=" self-center text-xs font-medium mb-1">
										{$i18n.t('Kagi Search API Key')}
									</div>

									<SensitiveInput
										placeholder={$i18n.t('Enter Kagi Search API Key')}
										bind:value={webConfig.KAGI_SEARCH_API_KEY}
									/>
								</div>
							</div>
						{:else if webConfig.WEB_SEARCH_ENGINE === 'mojeek'}
							<div class="mb-2.5 flex w-full flex-col">
								<div>
									<div class=" self-center text-xs font-medium mb-1">
										{$i18n.t('Mojeek Search API Key')}
									</div>

									<SensitiveInput
										placeholder={$i18n.t('Enter Mojeek Search API Key')}
										bind:value={webConfig.MOJEEK_SEARCH_API_KEY}
									/>
								</div>
							</div>
						{:else if webConfig.WEB_SEARCH_ENGINE === 'bocha'}
							<div class="mb-2.5 flex w-full flex-col">
								<div>
									<div class=" self-center text-xs font-medium mb-1">
										{$i18n.t('Bocha Search API Key')}
									</div>

									<SensitiveInput
										placeholder={$i18n.t('Enter Bocha Search API Key')}
										bind:value={webConfig.BOCHA_SEARCH_API_KEY}
									/>
								</div>
							</div>
						{:else if webConfig.WEB_SEARCH_ENGINE === 'serpstack'}
							<div class="mb-2.5 flex w-full flex-col">
								<div>
									<div class=" self-center text-xs font-medium mb-1">
										{$i18n.t('Serpstack API Key')}
									</div>

									<SensitiveInput
										placeholder={$i18n.t('Enter Serpstack API Key')}
										bind:value={webConfig.SERPSTACK_API_KEY}
									/>
								</div>
							</div>
						{:else if webConfig.WEB_SEARCH_ENGINE === 'serper'}
							<div class="mb-2.5 flex w-full flex-col">
								<div>
									<div class=" self-center text-xs font-medium mb-1">
										{$i18n.t('Serper API Key')}
									</div>

									<SensitiveInput
										placeholder={$i18n.t('Enter Serper API Key')}
										bind:value={webConfig.SERPER_API_KEY}
									/>
								</div>
							</div>
						{:else if webConfig.WEB_SEARCH_ENGINE === 'serply'}
							<div class="mb-2.5 flex w-full flex-col">
								<div>
									<div class=" self-center text-xs font-medium mb-1">
										{$i18n.t('Serply API Key')}
									</div>

									<SensitiveInput
										placeholder={$i18n.t('Enter Serply API Key')}
										bind:value={webConfig.SERPLY_API_KEY}
									/>
								</div>
							</div>
						{:else if webConfig.WEB_SEARCH_ENGINE === 'tavily'}
							<div class="mb-2.5 flex w-full flex-col">
								<div>
									<div class=" self-center text-xs font-medium mb-1">
										{$i18n.t('Tavily API Key')}
									</div>

									<SensitiveInput
										placeholder={$i18n.t('Enter Tavily API Key')}
										bind:value={webConfig.TAVILY_API_KEY}
									/>
								</div>
							</div>
						{:else if webConfig.WEB_SEARCH_ENGINE === 'searchapi'}
							<div class="mb-2.5 flex w-full flex-col">
								<div>
									<div class=" self-center text-xs font-medium mb-1">
										{$i18n.t('SearchApi API Key')}
									</div>

									<SensitiveInput
										placeholder={$i18n.t('Enter SearchApi API Key')}
										bind:value={webConfig.SEARCHAPI_API_KEY}
									/>
								</div>
								<div class="mt-1.5">
									<div class=" self-center text-xs font-medium mb-1">
										{$i18n.t('SearchApi Engine')}
									</div>

									<div class="flex w-full">
										<div class="flex-1">
											<input
												class="w-full rounded-lg py-2 px-4 text-sm bg-gray-50 dark:text-gray-300 dark:bg-gray-850 outline-hidden"
												type="text"
												placeholder={$i18n.t('Enter SearchApi Engine')}
												bind:value={webConfig.SEARCHAPI_ENGINE}
												autocomplete="off"
											/>
										</div>
									</div>
								</div>
							</div>
						{:else if webConfig.WEB_SEARCH_ENGINE === 'serpapi'}
							<div class="mb-2.5 flex w-full flex-col">
								<div>
									<div class=" self-center text-xs font-medium mb-1">
										{$i18n.t('SerpApi API Key')}
									</div>

									<SensitiveInput
										placeholder={$i18n.t('Enter SerpApi API Key')}
										bind:value={webConfig.SERPAPI_API_KEY}
									/>
								</div>
								<div class="mt-1.5">
									<div class=" self-center text-xs font-medium mb-1">
										{$i18n.t('SerpApi Engine')}
									</div>

									<div class="flex w-full">
										<div class="flex-1">
											<input
												class="w-full rounded-lg py-2 px-4 text-sm bg-gray-50 dark:text-gray-300 dark:bg-gray-850 outline-hidden"
												type="text"
												placeholder={$i18n.t('Enter SerpApi Engine')}
												bind:value={webConfig.SERPAPI_ENGINE}
												autocomplete="off"
											/>
										</div>
									</div>
								</div>
							</div>
						{:else if webConfig.WEB_SEARCH_ENGINE === 'jina'}
							<div class="mb-2.5 flex w-full flex-col">
								<div>
									<div class=" self-center text-xs font-medium mb-1">
										{$i18n.t('Jina API Base URL')}
									</div>

									<div class="flex w-full">
										<div class="flex-1">
											<input
												class="w-full rounded-lg py-2 px-4 text-sm bg-gray-50 dark:text-gray-300 dark:bg-gray-850 outline-hidden"
												type="text"
												placeholder={$i18n.t('Enter Jina API Base URL')}
												bind:value={webConfig.JINA_API_BASE_URL}
												autocomplete="off"
											/>
										</div>
									</div>
								</div>

								<div class="mt-2">
									<div class=" self-center text-xs font-medium mb-1">
										{$i18n.t('Jina API Key')}
									</div>

									<SensitiveInput
										placeholder={$i18n.t('Enter Jina API Key')}
										bind:value={webConfig.JINA_API_KEY}
									/>
								</div>
							</div>
						{:else if webConfig.WEB_SEARCH_ENGINE === 'bing'}
							<div class="mb-2.5 flex w-full flex-col">
								<div>
									<div class=" self-center text-xs font-medium mb-1">
										{$i18n.t('Bing Search V7 Endpoint')}
									</div>

									<div class="flex w-full">
										<div class="flex-1">
											<input
												class="w-full rounded-lg py-2 px-4 text-sm bg-gray-50 dark:text-gray-300 dark:bg-gray-850 outline-hidden"
												type="text"
												placeholder={$i18n.t('Enter Bing Search V7 Endpoint')}
												bind:value={webConfig.BING_SEARCH_V7_ENDPOINT}
												autocomplete="off"
											/>
										</div>
									</div>
								</div>

								<div class="mt-2">
									<div class=" self-center text-xs font-medium mb-1">
										{$i18n.t('Bing Search V7 Subscription Key')}
									</div>

									<SensitiveInput
										placeholder={$i18n.t('Enter Bing Search V7 Subscription Key')}
										bind:value={webConfig.BING_SEARCH_V7_SUBSCRIPTION_KEY}
									/>
								</div>
							</div>
						{:else if webConfig.WEB_SEARCH_ENGINE === 'exa'}
							<div class="mb-2.5 flex w-full flex-col">
								<div>
									<div class=" self-center text-xs font-medium mb-1">
										{$i18n.t('Exa API Key')}
									</div>

									<SensitiveInput
										placeholder={$i18n.t('Enter Exa API Key')}
										bind:value={webConfig.EXA_API_KEY}
									/>
								</div>
							</div>
						{:else if webConfig.WEB_SEARCH_ENGINE === 'perplexity'}
							<div class="mb-2.5 flex w-full flex-col">
								<div>
									<div class=" self-center text-xs font-medium mb-1">
										{$i18n.t('Perplexity API Key')}
									</div>

									<SensitiveInput
										placeholder={$i18n.t('Enter Perplexity API Key')}
										bind:value={webConfig.PERPLEXITY_API_KEY}
									/>
								</div>
							</div>

							<div class="mb-2.5 flex w-full flex-col">
								<div>
									<div class="self-center text-xs font-medium mb-1">
										{$i18n.t('Perplexity Model')}
									</div>
									<input
										list="perplexity-model-list"
										class="w-full rounded-lg py-2 px-4 text-sm bg-gray-50 dark:text-gray-300 dark:bg-gray-850 outline-hidden"
										bind:value={webConfig.PERPLEXITY_MODEL}
									/>

									<datalist id="perplexity-model-list">
										<option value="sonar">{$i18n.t('Sonar')}</option>
										<option value="sonar-pro">{$i18n.t('Sonar Pro')}</option>
										<option value="sonar-reasoning">{$i18n.t('Sonar Reasoning')}</option>
										<option value="sonar-reasoning-pro">{$i18n.t('Sonar Reasoning Pro')}</option>
										<option value="sonar-deep-research">{$i18n.t('Sonar Deep Research')}</option>
									</datalist>
								</div>
							</div>

							<div class="mb-2.5 flex w-full flex-col">
								<div>
									<div class=" self-center text-xs font-medium mb-1">
										{$i18n.t('Perplexity Search Context Usage')}
									</div>
									<select
										class="w-full rounded-lg py-2 px-4 text-sm bg-gray-50 dark:text-gray-300 dark:bg-gray-850 outline-hidden"
										bind:value={webConfig.PERPLEXITY_SEARCH_CONTEXT_USAGE}
									>
										<option value="low">{$i18n.t('Low')}</option>
										<option value="medium">{$i18n.t('Medium')}</option>
										<option value="high">{$i18n.t('High')}</option>
									</select>
								</div>
							</div>
						{:else if webConfig.WEB_SEARCH_ENGINE === 'sougou'}
							<div class="mb-2.5 flex w-full flex-col">
								<div>
									<div class=" self-center text-xs font-medium mb-1">
										{$i18n.t('Sougou Search API sID')}
									</div>

									<SensitiveInput
										placeholder={$i18n.t('Enter Sougou Search API sID')}
										bind:value={webConfig.SOUGOU_API_SID}
									/>
								</div>
							</div>
							<div class="mb-2.5 flex w-full flex-col">
								<div>
									<div class=" self-center text-xs font-medium mb-1">
										{$i18n.t('Sougou Search API SK')}
									</div>

									<SensitiveInput
										placeholder={$i18n.t('Enter Sougou Search API SK')}
										bind:value={webConfig.SOUGOU_API_SK}
									/>
								</div>
							</div>
						{:else if webConfig.WEB_SEARCH_ENGINE === 'firecrawl'}
							<div class="mb-2.5 flex w-full flex-col">
								<div>
									<div class=" self-center text-xs font-medium mb-1">
										{$i18n.t('Firecrawl API Base URL')}
									</div>

									<div class="flex w-full">
										<div class="flex-1">
											<input
												class="w-full rounded-lg py-2 px-4 text-sm bg-gray-50 dark:text-gray-300 dark:bg-gray-850 outline-hidden"
												type="text"
												placeholder={$i18n.t('Enter Firecrawl API Base URL')}
												bind:value={webConfig.FIRECRAWL_API_BASE_URL}
												autocomplete="off"
											/>
										</div>
									</div>
								</div>

								<div class="mt-2">
									<div class=" self-center text-xs font-medium mb-1">
										{$i18n.t('Firecrawl API Key')}
									</div>

									<SensitiveInput
										placeholder={$i18n.t('Enter Firecrawl API Key')}
										bind:value={webConfig.FIRECRAWL_API_KEY}
									/>
								</div>

								<div class="mt-2">
									<div class=" self-center text-xs font-medium mb-1">
										{$i18n.t('Firecrawl Timeout (s)')}
									</div>

									<div class="flex w-full">
										<div class="flex-1">
											<input
												class="w-full rounded-lg py-2 px-4 text-sm bg-gray-50 dark:text-gray-300 dark:bg-gray-850 outline-hidden"
												type="number"
												placeholder={$i18n.t('Enter Firecrawl Timeout')}
												bind:value={webConfig.FIRECRAWL_TIMEOUT}
												autocomplete="off"
											/>
										</div>
									</div>
								</div>
							</div>
						{:else if webConfig.WEB_SEARCH_ENGINE === 'external'}
							<div class="mb-2.5 flex w-full flex-col">
								<div>
									<div class=" self-center text-xs font-medium mb-1">
										{$i18n.t('External Web Search URL')}
									</div>

									<div class="flex w-full">
										<div class="flex-1">
											<input
												class="w-full rounded-lg py-2 px-4 text-sm bg-gray-50 dark:text-gray-300 dark:bg-gray-850 outline-hidden"
												type="text"
												placeholder={$i18n.t('Enter External Web Search URL')}
												bind:value={webConfig.EXTERNAL_WEB_SEARCH_URL}
												autocomplete="off"
											/>
										</div>
									</div>
								</div>

								<div class="mt-2">
									<div class=" self-center text-xs font-medium mb-1">
										{$i18n.t('External Web Search API Key')}
									</div>

									<SensitiveInput
										placeholder={$i18n.t('Enter External Web Search API Key')}
										bind:value={webConfig.EXTERNAL_WEB_SEARCH_API_KEY}
									/>
								</div>
							</div>
						{:else if webConfig.WEB_SEARCH_ENGINE === 'yandex'}
							<div class="mb-2.5 flex w-full flex-col">
								<div>
									<div class=" self-center text-xs font-medium mb-1">
										{$i18n.t('Yandex Web Search URL')}
									</div>

									<div class="flex w-full">
										<div class="flex-1">
											<input
												class="w-full rounded-lg py-2 px-4 text-sm bg-gray-50 dark:text-gray-300 dark:bg-gray-850 outline-hidden"
												type="text"
												placeholder={$i18n.t('Enter Yandex Web Search URL')}
												bind:value={webConfig.YANDEX_WEB_SEARCH_URL}
												autocomplete="off"
											/>
										</div>
									</div>
								</div>

								<div class="mt-2">
									<div class=" self-center text-xs font-medium mb-1">
										{$i18n.t('Yandex Web Search API Key')}
									</div>

									<SensitiveInput
										placeholder={$i18n.t('Enter Yandex Web Search API Key')}
										bind:value={webConfig.YANDEX_WEB_SEARCH_API_KEY}
									/>
								</div>

								<div class="mb-2.5">
									<div class=" mb-1 text-xs font-medium">{$i18n.t('Yandex Web Search config')}</div>

									<Tooltip
										content={$i18n.t(
											'Leave empty to use the default config, or enter a valid json (see https://yandex.cloud/en/docs/search-api/api-ref/WebSearch/search#yandex.cloud.searchapi.v2.WebSearchRequest)'
										)}
										placement="top-start"
									>
										<Textarea
											bind:value={webConfig.YANDEX_WEB_SEARCH_CONFIG}
											placeholder={$i18n.t(
												'Leave empty to use the default config, or enter a valid json (see https://yandex.cloud/en/docs/search-api/api-ref/WebSearch/search#yandex.cloud.searchapi.v2.WebSearchRequest)'
											)}
										/>
									</Tooltip>
								</div>
							</div>
						{:else if webConfig.WEB_SEARCH_ENGINE === 'youcom'}
							<div class="mb-2.5 flex w-full flex-col">
								<div>
									<div class=" self-center text-xs font-medium mb-1">
										{$i18n.t('You.com API Key')}
									</div>

									<SensitiveInput
										placeholder={$i18n.t('Enter You.com API Key')}
										bind:value={webConfig.YOUCOM_API_KEY}
									/>
								</div>
							</div>
						{/if}

						{#if webConfig.WEB_SEARCH_ENGINE === 'duckduckgo'}
							<div class="mb-2.5 flex w-full flex-col">
								<div>
									<div class=" self-center text-xs font-medium mb-1">
										{$i18n.t('DDGS Backend')}
									</div>

									<div class="flex w-full">
										<div class="flex-1">
											<select
												class="w-full rounded-lg py-2 px-4 text-sm bg-gray-50 dark:text-gray-300 dark:bg-gray-850 outline-hidden"
												bind:value={webConfig.DDGS_BACKEND}
											>
												<option value="auto">{$i18n.t('Auto (Random)')}</option>
												<option value="bing">{$i18n.t('Bing')}</option>
												<option value="brave">{$i18n.t('Brave')}</option>
												<option value="duckduckgo">{$i18n.t('DuckDuckGo')}</option>
												<option value="google">{$i18n.t('Google')}</option>
												<option value="grokipedia">{$i18n.t('Grokipedia')}</option>
												<option value="mojeek">{$i18n.t('Mojeek')}</option>
												<option value="wikipedia">{$i18n.t('Wikipedia')}</option>
												<option value="yahoo">{$i18n.t('Yahoo')}</option>
												<option value="yandex">{$i18n.t('Yandex')}</option>
											</select>
										</div>
									</div>
								</div>
							</div>
						{/if}
					{/if}

					{#if webConfig.ENABLE_WEB_SEARCH}
						<div class="mb-2.5 flex w-full flex-col">
							<div class="flex gap-2">
								<div class="w-full">
									<div class=" self-center text-xs font-medium mb-1">
										{$i18n.t('Search Result Count')}
									</div>

									<input
										class="w-full rounded-lg py-2 px-4 text-sm bg-gray-50 dark:text-gray-300 dark:bg-gray-850 outline-hidden"
										placeholder={$i18n.t('Search Result Count')}
										bind:value={webConfig.WEB_SEARCH_RESULT_COUNT}
										required
									/>
								</div>

								<div class="w-full">
									<div class=" self-center text-xs font-medium mb-1">
										<Tooltip
											content={$i18n.t(
												'Limit concurrent search queries. 0 = unlimited (default). Set to 1 for sequential execution (recommended for APIs with strict rate limits like Brave free tier).'
											)}
											placement="top-start"
										>
											{$i18n.t('Concurrent Requests')}
										</Tooltip>
									</div>

									<input
										class="w-full rounded-lg py-2 px-4 text-sm bg-gray-50 dark:text-gray-300 dark:bg-gray-850 outline-hidden"
										placeholder={$i18n.t('Concurrent Requests')}
										bind:value={webConfig.WEB_SEARCH_CONCURRENT_REQUESTS}
										type="number"
										min="0"
									/>
								</div>
							</div>
						</div>

						<div class="mb-2.5 w-full">
							<div class=" self-center text-xs font-medium mb-1">
								<Tooltip
									content={$i18n.t(
										'Maximum characters to return from fetched URLs. Leave empty for no limit.'
									)}
									placement="top-start"
								>
									{$i18n.t('Fetch URL Content Length Limit')}
								</Tooltip>
							</div>

							<input
								class="w-full rounded-lg py-2 px-4 text-sm bg-gray-50 dark:text-gray-300 dark:bg-gray-850 outline-hidden"
								placeholder={$i18n.t('No limit')}
								bind:value={webConfig.WEB_FETCH_MAX_CONTENT_LENGTH}
								type="number"
								min="0"
							/>
						</div>

						<div class="mb-2.5 flex w-full flex-col">
							<div class="  text-xs font-medium mb-1">
								{$i18n.t('Domain Filter List')}
							</div>

							<input
								class="w-full rounded-lg py-2 px-4 text-sm bg-gray-50 dark:text-gray-300 dark:bg-gray-850 outline-hidden"
								placeholder={$i18n.t(
									'Enter domains separated by commas (e.g., example.com,site.org,!excludedsite.com)'
								)}
								bind:value={webConfig.WEB_SEARCH_DOMAIN_FILTER_LIST}
							/>
						</div>
					{/if}

					<div class="  mb-2.5 flex w-full justify-between">
						<div class=" self-center text-xs font-medium">
							<Tooltip content={$i18n.t('Full Context Mode')} placement="top-start">
								{$i18n.t('Bypass Embedding and Retrieval')}
							</Tooltip>
						</div>
						<div class="flex items-center relative">
							<Tooltip
								content={webConfig.BYPASS_WEB_SEARCH_EMBEDDING_AND_RETRIEVAL
									? $i18n.t(
											'Inject the entire content as context for comprehensive processing, this is recommended for complex queries.'
										)
									: $i18n.t(
											'Default to segmented retrieval for focused and relevant content extraction, this is recommended for most cases.'
										)}
							>
								<Switch bind:state={webConfig.BYPASS_WEB_SEARCH_EMBEDDING_AND_RETRIEVAL} />
							</Tooltip>
						</div>
					</div>

					<div class="  mb-2.5 flex w-full justify-between">
						<div class=" self-center text-xs font-medium">
							<Tooltip content={$i18n.t('Bypass Web Loader')} placement="top-start">
								{$i18n.t('Bypass Web Loader')}
							</Tooltip>
						</div>
						<div class="flex items-center relative">
							<Tooltip content={''}>
								<Switch bind:state={webConfig.BYPASS_WEB_SEARCH_WEB_LOADER} />
							</Tooltip>
						</div>
					</div>

					<div class="  mb-2.5 flex w-full justify-between">
						<div class=" self-center text-xs font-medium">
							{$i18n.t('Trust Proxy Environment')}
						</div>
						<div class="flex items-center relative">
							<Tooltip
								content={webConfig.WEB_SEARCH_TRUST_ENV
									? $i18n.t(
											'Use proxy designated by http_proxy and https_proxy environment variables to fetch page contents.'
										)
									: $i18n.t('Use no proxy to fetch page contents.')}
							>
								<Switch bind:state={webConfig.WEB_SEARCH_TRUST_ENV} />
							</Tooltip>
						</div>
					</div>
				</div>

				<div class="mb-3">
					<div class=" mt-0.5 mb-2.5 text-base font-medium">{$i18n.t('Loader')}</div>

					<hr class=" border-gray-100/30 dark:border-gray-850/30 my-2" />

					<div class="  mb-2.5 flex w-full justify-between">
						<div class=" self-center text-xs font-medium">
							{$i18n.t('Web Loader Engine')}
						</div>
						<div class="flex items-center relative">
							<select
								class="w-fit pr-8 rounded-sm px-2 p-1 text-xs bg-transparent outline-hidden text-right"
								bind:value={webConfig.WEB_LOADER_ENGINE}
								placeholder={$i18n.t('Select a engine')}
							>
								<option value="">{$i18n.t('Default')}</option>
								{#each webLoaderEngines as engine}
									<option value={engine}>{engine}</option>
								{/each}
							</select>
						</div>
					</div>

					{#if webConfig.WEB_LOADER_ENGINE === '' || webConfig.WEB_LOADER_ENGINE === 'safe_web'}
						<div class="  mb-2.5 flex w-full justify-between">
							<div class=" self-center text-xs font-medium">
								{$i18n.t('Timeout')}
							</div>
							<div class="flex items-center relative">
								<input
									class="flex-1 w-full text-sm bg-transparent outline-hidden"
									placeholder={$i18n.t('Timeout')}
									bind:value={webConfig.WEB_LOADER_TIMEOUT}
								/>
							</div>
						</div>

						<div class="  mb-2.5 flex w-full justify-between">
							<div class=" self-center text-xs font-medium">
								{$i18n.t('Verify SSL Certificate')}
							</div>
							<div class="flex items-center relative">
								<Switch bind:state={webConfig.ENABLE_WEB_LOADER_SSL_VERIFICATION} />
							</div>
						</div>
					{:else if webConfig.WEB_LOADER_ENGINE === 'playwright'}
						<div class="mb-2.5 flex w-full flex-col">
							<div>
								<div class=" self-center text-xs font-medium mb-1">
									{$i18n.t('Playwright WebSocket URL')}
								</div>

								<div class="flex w-full">
									<div class="flex-1">
										<input
											class="w-full rounded-lg py-2 px-4 text-sm bg-gray-50 dark:text-gray-300 dark:bg-gray-850 outline-hidden"
											type="text"
											placeholder={$i18n.t('Enter Playwright WebSocket URL')}
											bind:value={webConfig.PLAYWRIGHT_WS_URL}
											autocomplete="off"
										/>
									</div>
								</div>
							</div>

							<div class="mt-2">
								<div class=" self-center text-xs font-medium mb-1">
									{$i18n.t('Playwright Timeout (ms)')}
								</div>

								<div class="flex w-full">
									<div class="flex-1">
										<input
											class="w-full rounded-lg py-2 px-4 text-sm bg-gray-50 dark:text-gray-300 dark:bg-gray-850 outline-hidden"
											placeholder={$i18n.t('Enter Playwright Timeout')}
											bind:value={webConfig.PLAYWRIGHT_TIMEOUT}
											autocomplete="off"
										/>
									</div>
								</div>
							</div>
						</div>
					{:else if webConfig.WEB_LOADER_ENGINE === 'firecrawl' && webConfig.WEB_SEARCH_ENGINE !== 'firecrawl'}
						<div class="mb-2.5 flex w-full flex-col">
							<div>
								<div class=" self-center text-xs font-medium mb-1">
									{$i18n.t('Firecrawl API Base URL')}
								</div>

								<div class="flex w-full">
									<div class="flex-1">
										<input
											class="w-full rounded-lg py-2 px-4 text-sm bg-gray-50 dark:text-gray-300 dark:bg-gray-850 outline-hidden"
											type="text"
											placeholder={$i18n.t('Enter Firecrawl API Base URL')}
											bind:value={webConfig.FIRECRAWL_API_BASE_URL}
											autocomplete="off"
										/>
									</div>
								</div>
							</div>

							<div class="mt-2">
								<div class=" self-center text-xs font-medium mb-1">
									{$i18n.t('Firecrawl API Key')}
								</div>

								<SensitiveInput
									placeholder={$i18n.t('Enter Firecrawl API Key')}
									bind:value={webConfig.FIRECRAWL_API_KEY}
								/>
							</div>
						</div>
					{:else if webConfig.WEB_LOADER_ENGINE === 'tavily'}
						<div class="mb-2.5 flex w-full flex-col">
							<div>
								<div class=" self-center text-xs font-medium mb-1">
									{$i18n.t('Tavily Extract Depth')}
								</div>

								<div class="flex w-full">
									<div class="flex-1">
										<input
											class="w-full rounded-lg py-2 px-4 text-sm bg-gray-50 dark:text-gray-300 dark:bg-gray-850 outline-hidden"
											type="text"
											placeholder={$i18n.t('Enter Tavily Extract Depth')}
											bind:value={webConfig.TAVILY_EXTRACT_DEPTH}
											autocomplete="off"
										/>
									</div>
								</div>
							</div>

							{#if webConfig.WEB_SEARCH_ENGINE !== 'tavily'}
								<div class="mt-2">
									<div class=" self-center text-xs font-medium mb-1">
										{$i18n.t('Tavily API Key')}
									</div>

									<SensitiveInput
										placeholder={$i18n.t('Enter Tavily API Key')}
										bind:value={webConfig.TAVILY_API_KEY}
									/>
								</div>
							{/if}
						</div>
					{:else if webConfig.WEB_LOADER_ENGINE === 'external'}
						<div class="mb-2.5 flex w-full flex-col">
							<div>
								<div class=" self-center text-xs font-medium mb-1">
									{$i18n.t('External Web Loader URL')}
								</div>

								<div class="flex w-full">
									<div class="flex-1">
										<input
											class="w-full rounded-lg py-2 px-4 text-sm bg-gray-50 dark:text-gray-300 dark:bg-gray-850 outline-hidden"
											type="text"
											placeholder={$i18n.t('Enter External Web Loader URL')}
											bind:value={webConfig.EXTERNAL_WEB_LOADER_URL}
											autocomplete="off"
										/>
									</div>
								</div>
							</div>

							<div class="mt-2">
								<div class=" self-center text-xs font-medium mb-1">
									{$i18n.t('External Web Loader API Key')}
								</div>

								<SensitiveInput
									placeholder={$i18n.t('Enter External Web Loader API Key')}
									bind:value={webConfig.EXTERNAL_WEB_LOADER_API_KEY}
								/>
							</div>
						</div>
					{/if}

					<div class="mb-2.5 w-full">
						<div class=" self-center text-xs font-medium mb-1">
							{$i18n.t('Concurrent Requests')}
						</div>

						<input
							class="w-full rounded-lg py-2 px-4 text-sm bg-gray-50 dark:text-gray-300 dark:bg-gray-850 outline-hidden"
							placeholder={$i18n.t('Concurrent Requests')}
							bind:value={webConfig.WEB_LOADER_CONCURRENT_REQUESTS}
							required
						/>
					</div>

					<div class="  mb-2.5 flex w-full justify-between">
						<div class=" self-center text-xs font-medium">
							{$i18n.t('Youtube Language')}
						</div>
						<div class="flex items-center relative">
							<input
								class="flex-1 w-full rounded-lg text-sm bg-transparent outline-hidden"
								type="text"
								placeholder={$i18n.t('Enter language codes')}
								bind:value={webConfig.YOUTUBE_LOADER_LANGUAGE}
								autocomplete="off"
							/>
						</div>
					</div>

					<div class="  mb-2.5 flex flex-col w-full justify-between">
						<div class=" mb-1 text-xs font-medium">
							{$i18n.t('Youtube Proxy URL')}
						</div>
						<div class="flex items-center relative">
							<input
								class="flex-1 w-full rounded-lg text-sm bg-transparent outline-hidden"
								type="text"
								placeholder={$i18n.t('Enter proxy URL (e.g. https://user:password@host:port)')}
								bind:value={webConfig.YOUTUBE_LOADER_PROXY_URL}
								autocomplete="off"
							/>
						</div>
					</div>
				</div>
			</div>
		{/if}
	</div>
	<div class="flex justify-end pt-3 text-sm font-medium">
		<button
			class="px-3.5 py-1.5 text-sm font-medium bg-black hover:bg-gray-900 text-white dark:bg-white dark:text-black dark:hover:bg-gray-100 transition rounded-full"
			type="submit"
		>
			{$i18n.t('Save')}
		</button>
	</div>
</form>
