<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { createEventDispatcher, onMount, getContext } from 'svelte';
	import { getLanguages, changeLanguage } from '$lib/i18n';
	import type { Settings } from '$lib/stores';
	const dispatch = createEventDispatcher();

	import { config, models, settings, theme, user } from '$lib/stores';

	const i18n = getContext('i18n');

	import AdvancedParams from './Advanced/AdvancedParams.svelte';
	import Textarea from '$lib/components/common/Textarea.svelte';

	type ThemeChoice = 'system' | 'dark' | 'oled-dark' | 'light' | 'her';

	type GeneralSettingsParams = {
		stream_response: boolean | null;
		stream_delta_chunk_size: number | null;
		function_calling: string | null;
		reasoning_tags: boolean | [string, string] | null;
		seed: number | null;
		stop: string | string[] | null;
		temperature: number | null;
		reasoning_effort: string | null;
		logit_bias: string | null;
		frequency_penalty: number | null;
		presence_penalty: number | null;
		repeat_penalty: number | null;
		repeat_last_n: number | null;
		mirostat: number | null;
		mirostat_eta: number | null;
		mirostat_tau: number | null;
		top_k: number | null;
		top_p: number | null;
		min_p: number | null;
		tfs_z: number | null;
		num_ctx: number | null;
		num_batch: number | null;
		num_keep: number | null;
		max_tokens: number | null;
		use_mmap: boolean | null;
		use_mlock: boolean | null;
		num_thread: number | null;
		num_gpu: number | null;
		think: boolean | null;
		keep_alive: string | null;
		format: string | null;
		custom_params?: Record<string, unknown>;
	};

	type GeneralSettingsPatch = Pick<Settings, 'notificationEnabled'> & {
		system?: string;
		params?: Partial<GeneralSettingsParams>;
	};

	const defaultParams: GeneralSettingsParams = {
		stream_response: null,
		stream_delta_chunk_size: null,
		function_calling: null,
		reasoning_tags: null,
		seed: null,
		stop: null,
		temperature: null,
		reasoning_effort: null,
		logit_bias: null,
		frequency_penalty: null,
		presence_penalty: null,
		repeat_penalty: null,
		repeat_last_n: null,
		mirostat: null,
		mirostat_eta: null,
		mirostat_tau: null,
		top_k: null,
		top_p: null,
		min_p: null,
		tfs_z: null,
		num_ctx: null,
		num_batch: null,
		num_keep: null,
		max_tokens: null,
		use_mmap: null,
		use_mlock: null,
		num_thread: null,
		num_gpu: null,
		think: null,
		keep_alive: null,
		format: null
	};

	export let saveSettings: (settings: GeneralSettingsPatch) => void | Promise<void>;

	// General
	const themes: ThemeChoice[] = ['dark', 'light', 'oled-dark', 'her'];
	let selectedTheme: ThemeChoice = 'system';

	let languages: Awaited<ReturnType<typeof getLanguages>> = [];
	let lang = $i18n.language;
	let notificationEnabled = false;
	let system = '';

	let showAdvanced = false;

	const toggleNotification = async () => {
		const permission = await Notification.requestPermission();

		if (permission === 'granted') {
			notificationEnabled = !notificationEnabled;
			saveSettings({ notificationEnabled: notificationEnabled });
		} else {
			toast.error(
				$i18n.t(
					'Response notifications cannot be activated as the website permissions have been denied. Please visit your browser settings to grant the necessary access.'
				)
			);
		}
	};

	let params: GeneralSettingsParams = { ...defaultParams };

	const toUndefined = <T>(value: T | null | undefined): T | undefined =>
		value === null || value === undefined ? undefined : value;

	const saveHandler = async () => {
		saveSettings({
			system: system !== '' ? system : undefined,
			params: {
				stream_response: toUndefined(params.stream_response),
				stream_delta_chunk_size: toUndefined(params.stream_delta_chunk_size),
				function_calling: toUndefined(params.function_calling),
				reasoning_tags: toUndefined(params.reasoning_tags),
				seed: toUndefined(params.seed),
					stop: Array.isArray(params.stop)
						? params.stop.filter((entry: string) => entry.trim())
						: params.stop?.trim()
							? params.stop
									.split(',')
									.map((entry) => entry.trim())
									.filter(Boolean)
							: undefined,
				temperature: toUndefined(params.temperature),
				reasoning_effort: toUndefined(params.reasoning_effort),
				logit_bias: toUndefined(params.logit_bias),
				frequency_penalty: toUndefined(params.frequency_penalty),
				presence_penalty: toUndefined(params.presence_penalty),
				repeat_penalty: toUndefined(params.repeat_penalty),
				repeat_last_n: toUndefined(params.repeat_last_n),
				mirostat: toUndefined(params.mirostat),
				mirostat_eta: toUndefined(params.mirostat_eta),
				mirostat_tau: toUndefined(params.mirostat_tau),
				top_k: toUndefined(params.top_k),
				top_p: toUndefined(params.top_p),
				min_p: toUndefined(params.min_p),
				tfs_z: toUndefined(params.tfs_z),
				num_ctx: toUndefined(params.num_ctx),
				num_batch: toUndefined(params.num_batch),
				num_keep: toUndefined(params.num_keep),
				max_tokens: toUndefined(params.max_tokens),
				use_mmap: toUndefined(params.use_mmap),
				use_mlock: toUndefined(params.use_mlock),
				num_thread: toUndefined(params.num_thread),
				num_gpu: toUndefined(params.num_gpu),
				think: toUndefined(params.think),
				keep_alive: toUndefined(params.keep_alive),
				format: toUndefined(params.format)
			}
		});
		dispatch('save');
	};

	onMount(async () => {
		selectedTheme = localStorage.theme ?? 'system';

		languages = await getLanguages();

		if (!$config?.features?.enable_easter_eggs) {
			languages = languages.filter((l) => l.code !== 'dg-DG');
		}

		notificationEnabled = $settings.notificationEnabled ?? false;
		system = $settings.system ?? '';

		params = { ...defaultParams, ...($settings?.params ?? {}) } as GeneralSettingsParams;
			params.stop = Array.isArray($settings?.params?.stop)
				? $settings.params.stop.filter((entry: string) => typeof entry === 'string').join(',')
				: null;
	});

	const applyTheme = (_theme: ThemeChoice) => {
		let themeToApply = _theme === 'oled-dark' ? 'dark' : _theme === 'her' ? 'light' : _theme;

		if (_theme === 'system') {
			themeToApply = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
		}

		if (themeToApply === 'dark' && !_theme.includes('oled')) {
			document.documentElement.style.setProperty('--color-gray-800', '#333');
			document.documentElement.style.setProperty('--color-gray-850', '#262626');
			document.documentElement.style.setProperty('--color-gray-900', '#171717');
			document.documentElement.style.setProperty('--color-gray-950', '#0d0d0d');
		}

		themes
			.filter((e) => e !== themeToApply)
			.forEach((e) => {
				e.split(' ').forEach((e) => {
					document.documentElement.classList.remove(e);
				});
			});

		themeToApply.split(' ').forEach((e) => {
			document.documentElement.classList.add(e);
		});

		const metaThemeColor = document.querySelector('meta[name="theme-color"]');
		if (metaThemeColor) {
			if (_theme.includes('system')) {
				const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
					? 'dark'
					: 'light';
				console.log('Setting system meta theme color: ' + systemTheme);
				metaThemeColor.setAttribute('content', systemTheme === 'light' ? '#ffffff' : '#171717');
			} else {
				console.log('Setting meta theme color: ' + _theme);
				metaThemeColor.setAttribute(
					'content',
					_theme === 'dark'
						? '#171717'
						: _theme === 'oled-dark'
							? '#000000'
							: _theme === 'her'
								? '#983724'
								: '#ffffff'
				);
			}
		}

		if (typeof window !== 'undefined') {
			const windowWithTheme = window as Window & { applyTheme?: () => void };
			windowWithTheme.applyTheme?.();
		}

		if (_theme.includes('oled')) {
			document.documentElement.style.setProperty('--color-gray-800', '#101010');
			document.documentElement.style.setProperty('--color-gray-850', '#050505');
			document.documentElement.style.setProperty('--color-gray-900', '#000000');
			document.documentElement.style.setProperty('--color-gray-950', '#000000');
			document.documentElement.classList.add('dark');
		}

		console.log(_theme);
	};

	const themeChangeHandler = (_theme: ThemeChoice) => {
		theme.set(_theme);
		localStorage.setItem('theme', _theme);
		applyTheme(_theme);
	};
</script>

<div class="flex flex-col h-full justify-between text-sm" id="tab-general">
	<div class="  overflow-y-scroll max-h-[28rem] md:max-h-full">
		<div class="">
			<div class=" mb-1 text-sm font-medium">{$i18n.t('WebUI Settings')}</div>

			<div class="flex w-full justify-between">
				<div class=" self-center text-xs font-medium">{$i18n.t('Theme')}</div>
				<div class="flex items-center relative">
					<select
						class="w-fit pr-8 rounded-sm py-2 px-2 text-xs bg-transparent text-right {$settings.highContrastMode
							? ''
							: 'outline-hidden'}"
						bind:value={selectedTheme}
						placeholder={$i18n.t('Select a theme')}
						on:change={() => themeChangeHandler(selectedTheme)}
					>
						<option value="system">⚙️ {$i18n.t('System')}</option>
						<option value="dark">🌑 {$i18n.t('Dark')}</option>
						<option value="oled-dark">🌃 {$i18n.t('OLED Dark')}</option>
						<option value="light">☀️ {$i18n.t('Light')}</option>
						{#if $config?.features?.enable_easter_eggs}
							<option value="her">🌷 Her</option>
						{/if}
					</select>
				</div>
			</div>

			<div class=" flex w-full justify-between">
				<div class=" self-center text-xs font-medium">{$i18n.t('Language')}</div>
				<div class="flex items-center relative">
					<select
						class="w-fit pr-8 rounded-sm py-2 px-2 text-xs bg-transparent text-right {$settings.highContrastMode
							? ''
							: 'outline-hidden'}"
						bind:value={lang}
						placeholder={$i18n.t('Select a language')}
						on:change={(e) => {
							changeLanguage(lang);
						}}
					>
						{#each languages as language}
							<option value={language['code']}>{language['title']}</option>
						{/each}
					</select>
				</div>
			</div>
			{#if $i18n.language === 'en-US' && !($config?.license_metadata ?? false)}
				<div
					class="mb-2 text-xs {($settings?.highContrastMode ?? false)
						? 'text-gray-800 dark:text-gray-100'
						: 'text-gray-400 dark:text-gray-500'}"
				>
					Couldn't find your language?
					<a
						class="font-medium underline {($settings?.highContrastMode ?? false)
							? 'text-gray-700 dark:text-gray-200'
							: 'text-gray-300'}"
						href="https://github.com/open-webui/open-webui/blob/main/docs/CONTRIBUTING.md#-translations-and-internationalization"
						target="_blank"
					>
						Help us translate Open WebUI!
					</a>
				</div>
			{/if}

			<div>
				<div class=" py-0.5 flex w-full justify-between">
					<div class=" self-center text-xs font-medium">{$i18n.t('Notifications')}</div>

					<button
						class="p-1 px-3 text-xs flex rounded-sm transition"
						on:click={() => {
							toggleNotification();
						}}
						type="button"
						role="switch"
						aria-checked={notificationEnabled}
					>
						{#if notificationEnabled === true}
							<span class="ml-2 self-center">{$i18n.t('On')}</span>
						{:else}
							<span class="ml-2 self-center">{$i18n.t('Off')}</span>
						{/if}
					</button>
				</div>
			</div>
		</div>

		{#if $user?.role === 'admin' || (($user?.permissions.chat?.controls ?? true) && ($user?.permissions.chat?.system_prompt ?? true))}
			<hr class="border-gray-100/30 dark:border-gray-850/30 my-3" />

			<div>
				<div class=" my-2.5 text-sm font-medium">{$i18n.t('System Prompt')}</div>
				<Textarea
					bind:value={system}
					className={'w-full text-sm outline-hidden resize-vertical' +
						($settings.highContrastMode
							? ' p-2.5 border-2 border-gray-300 dark:border-gray-700 rounded-lg bg-transparent text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 overflow-y-hidden'
							: '  dark:text-gray-300 ')}
					rows={4}
					placeholder={$i18n.t('Enter system prompt here')}
				/>
			</div>
		{/if}

		{#if $user?.role === 'admin' || (($user?.permissions.chat?.controls ?? true) && ($user?.permissions.chat?.params ?? true))}
			<div class="mt-2 space-y-3 pr-1.5">
				<div class="flex justify-between items-center text-sm">
					<div class="  font-medium">{$i18n.t('Advanced Parameters')}</div>
					<button
						class=" text-xs font-medium {($settings?.highContrastMode ?? false)
							? 'text-gray-800 dark:text-gray-100'
							: 'text-gray-400 dark:text-gray-500'}"
						type="button"
						aria-expanded={showAdvanced}
						on:click={() => {
							showAdvanced = !showAdvanced;
						}}>{showAdvanced ? $i18n.t('Hide') : $i18n.t('Show')}</button
					>
				</div>

				{#if showAdvanced}
					<AdvancedParams admin={$user?.role === 'admin'} bind:params />
				{/if}
			</div>
		{/if}
	</div>

	<div class="flex justify-end pt-3 text-sm font-medium">
		<button
			class="px-3.5 py-1.5 text-sm font-medium bg-black hover:bg-gray-900 text-white dark:bg-white dark:text-black dark:hover:bg-gray-100 transition rounded-full"
			on:click={() => {
				saveHandler();
			}}
		>
			{$i18n.t('Save')}
		</button>
	</div>
</div>
