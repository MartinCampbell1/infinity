<!-- @ts-nocheck -->
<script lang="ts">
	// @ts-nocheck
	import { onDestroy } from 'svelte';

	export let currentSlide = 0;
	export let selectedFile = '';
	export let fileLoading = false;
	export let fileContent: string | null = null;
	export let fileImageUrl: string | null = null;
	export let fileVideoUrl: string | null = null;
	export let fileAudioUrl: string | null = null;
	export let filePdfData: ArrayBuffer | null = null;
	export let fileSqliteData: ArrayBuffer | null = null;
	export let fileOfficeHtml: string | null = null;
	export let fileOfficeSlides: string[] | null = null;
	export let excelSheetNames: string[] = [];
	export let selectedExcelSheet = '';
	export let onSheetChange: ((sheet: string) => Promise<void> | void) | null = null;

	let pdfUrl: string | null = null;

	$: if (filePdfData) {
		const blob = new Blob([filePdfData], { type: 'application/pdf' });
		const nextPdfUrl = URL.createObjectURL(blob);
		if (pdfUrl) {
			URL.revokeObjectURL(pdfUrl);
		}
		pdfUrl = nextPdfUrl;
	} else if (pdfUrl) {
		URL.revokeObjectURL(pdfUrl);
		pdfUrl = null;
	}

	onDestroy(() => {
		if (pdfUrl) {
			URL.revokeObjectURL(pdfUrl);
		}
	});
</script>

<div class="flex h-full min-h-0 w-full flex-col gap-3 overflow-hidden p-3">
	<div class="flex items-center justify-between gap-3 text-xs text-gray-500 dark:text-gray-400">
		<div class="min-w-0 truncate font-medium text-gray-700 dark:text-gray-200">
			{selectedFile || 'Preview'}
		</div>
		{#if fileLoading}
			<div>Loading...</div>
		{/if}
	</div>

	{#if excelSheetNames.length > 1}
		<div class="flex items-center gap-2 text-xs">
			<label for="file-preview-sheet" class="text-gray-500 dark:text-gray-400">Sheet</label>
			<select
				id="file-preview-sheet"
				class="rounded-md border border-gray-200 bg-white px-2 py-1 text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200"
				bind:value={selectedExcelSheet}
				on:change={(event) => onSheetChange?.((event.currentTarget as HTMLSelectElement).value)}
			>
				{#each excelSheetNames as sheet}
					<option value={sheet}>{sheet}</option>
				{/each}
			</select>
		</div>
	{/if}

		<div class="min-h-0 flex-1 overflow-auto rounded-lg border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-950">
		{#if fileImageUrl}
			<img src={fileImageUrl} alt={selectedFile} class="h-auto w-full" />
		{:else if fileVideoUrl}
			<video src={fileVideoUrl} controls class="h-full w-full">
				<track kind="captions" label="Captions" src="data:text/vtt,WEBVTT%0A%0A" />
			</video>
		{:else if fileAudioUrl}
			<audio src={fileAudioUrl} controls class="w-full"></audio>
		{:else if pdfUrl}
			<iframe title={selectedFile} src={pdfUrl} class="h-[32rem] w-full"></iframe>
		{:else if fileOfficeSlides?.length}
			<div class="flex h-full flex-col items-center justify-between gap-3 p-3">
				<img
					src={fileOfficeSlides[Math.max(0, Math.min(currentSlide, fileOfficeSlides.length - 1))]}
					alt={selectedFile}
					class="max-h-[28rem] w-full object-contain"
				/>
				{#if fileOfficeSlides.length > 1}
					<div class="flex items-center gap-2">
						<button
							type="button"
							class="rounded-md border border-gray-200 px-2 py-1 text-xs dark:border-gray-800"
							on:click={() => (currentSlide = Math.max(0, currentSlide - 1))}
						>
							Prev
						</button>
						<div class="text-xs text-gray-500 dark:text-gray-400">
							{currentSlide + 1} / {fileOfficeSlides.length}
						</div>
						<button
							type="button"
							class="rounded-md border border-gray-200 px-2 py-1 text-xs dark:border-gray-800"
							on:click={() =>
								(currentSlide = Math.min(fileOfficeSlides.length - 1, currentSlide + 1))}
						>
							Next
						</button>
					</div>
				{/if}
			</div>
		{:else if fileOfficeHtml}
			<div class="prose max-w-none p-3">
				{@html fileOfficeHtml}
			</div>
		{:else if fileSqliteData}
			<div class="p-4 text-sm text-gray-500 dark:text-gray-400">
				SQLite preview is available as an attachable artifact.
			</div>
		{:else if fileContent !== null}
			<pre class="whitespace-pre-wrap break-words p-4 text-sm text-gray-800 dark:text-gray-200">{fileContent}</pre>
		{:else}
			<div class="p-4 text-sm text-gray-500 dark:text-gray-400">
				No preview available yet.
			</div>
		{/if}
	</div>
</div>
