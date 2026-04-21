<script lang="ts">
	import { decode } from 'html-entities';
	import { onMount, getContext } from 'svelte';
	const i18n = getContext('i18n');

	import fileSaver from 'file-saver';
	const { saveAs } = fileSaver;

	import { marked, type Token } from 'marked';
	import { copyToClipboard, unescapeHtml } from '$lib/utils';

	import { WEBUI_BASE_URL } from '$lib/constants';
	import { settings } from '$lib/stores';

	import CodeBlock from '$lib/components/chat/Messages/CodeBlock.svelte';
	import MarkdownInlineTokens from '$lib/components/chat/Messages/Markdown/MarkdownInlineTokens.svelte';
	import KatexRenderer from './KatexRenderer.svelte';
	import AlertRenderer, { alertComponent } from './AlertRenderer.svelte';
	import Collapsible from '$lib/components/common/Collapsible.svelte';
	import ToolCallDisplay from '$lib/components/common/ToolCallDisplay.svelte';
	import Tooltip from '$lib/components/common/Tooltip.svelte';
	import Download from '$lib/components/icons/Download.svelte';
	import ConsecutiveDetailsGroup from './ConsecutiveDetailsGroup.svelte';

	import HtmlToken from './HTMLToken.svelte';
	import Clipboard from '$lib/components/icons/Clipboard.svelte';
	import ColonFenceBlock from './ColonFenceBlock.svelte';

	type MarkdownDetailAttributes = {
		type?: string;
		name?: string;
		done?: string;
		duration?: string;
		embeds?: string;
		arguments?: string;
		[key: string]: unknown;
	};

	type MarkdownDetailToken = Token & {
		type: 'details';
		summary?: string;
		text: string;
		attributes?: MarkdownDetailAttributes;
	};

	type MarkdownDetailGroupToken = {
		type: 'detail_group';
		items: MarkdownDetailToken[];
	};

	type MarkdownTableHeaderCell = {
		text: string;
		tokens?: Token[];
	};

	type MarkdownTableCell = {
		tokens: Token[];
	};

	type MarkdownTableToken = Token & {
		type: 'table';
		header: MarkdownTableHeaderCell[];
		rows: MarkdownTableCell[][];
		align: Array<string | null | undefined>;
		raw: string;
	};

	type MarkdownCodeToken = Token & {
		type: 'code';
		raw: string;
		text: string;
		lang?: string;
	};

	type MarkdownCodeBlockToken = {
		text: string;
		raw: string;
		lang?: string;
		[key: string]: unknown;
	};

	type MarkdownCodeBlockOnUpdate = (token: MarkdownCodeBlockToken | null) => void;
	type MarkdownCodeBlockOnPreview = (value: string) => void;

	type MarkdownHeadingToken = Token & {
		type: 'heading';
		depth: number;
		tokens?: Token[];
	};

	type MarkdownListItem = {
		task?: boolean;
		checked?: boolean;
		tokens: Token[];
	};

	type MarkdownListToken = Token & {
		type: 'list';
		ordered?: boolean;
		start?: number;
		loose?: boolean;
		items: MarkdownListItem[];
	};

	type MarkdownBlockquoteToken = Token & {
		type: 'blockquote';
		tokens: Token[];
	};

	type MarkdownParagraphToken = Token & {
		type: 'paragraph';
		tokens?: Token[];
	};

	type MarkdownTextToken = Token & {
		type: 'text';
		text: string;
		tokens?: Token[];
	};

	type MarkdownIframeToken = Token & {
		type: 'iframe';
		fileId?: string | number;
	};

	type MarkdownColonFenceToken = Token & {
		type: 'colonFence';
		fenceType?: string;
		text: string;
		tokens?: Token[];
	};

	type MarkdownDisplayToken = Token | MarkdownDetailGroupToken | MarkdownDetailToken;

	export let id: string;
	export let tokens: Token[];
	export let top = true;
	export let attributes = {};
	export let sourceIds: string[] = [];

	export let done = true;

	export let save = false;
	export let preview = false;

	export let paragraphTag = 'p';

	export let editCodeBlock = true;
	export let topPadding = false;

	export let onSave: Function = () => {};
	export let onUpdate: MarkdownCodeBlockOnUpdate = () => {};
	export let onPreview: MarkdownCodeBlockOnPreview = () => {};

	export let onTaskClick: Function = () => {};
	export let onSourceClick: Function = () => {};

	const headerComponent = (depth: number) => {
		return 'h' + depth;
	};

	const GROUPABLE_DETAIL_TYPES = new Set(['tool_calls', 'reasoning', 'code_interpreter']);

	const isGroupableDetailToken = (token: Token & { attributes?: { type?: string } }) => {
		return token?.type === 'details' && GROUPABLE_DETAIL_TYPES.has(token?.attributes?.type ?? '');
	};

	const getDisplayTokens = (tokenList: Token[] = []): MarkdownDisplayToken[] => {
		const displayTokens: MarkdownDisplayToken[] = [];
		let detailGroup: MarkdownDetailToken[] = [];

		const flushDetailGroup = () => {
			if (detailGroup.length > 1) {
				displayTokens.push({
					type: 'detail_group',
					items: [...detailGroup]
				});
			} else if (detailGroup.length === 1) {
				displayTokens.push(detailGroup[0]);
			}

			detailGroup = [];
		};

		for (const token of tokenList) {
			if (isGroupableDetailToken(token)) {
				detailGroup.push(token as MarkdownDetailToken);
			} else {
				flushDetailGroup();
				displayTokens.push(token as MarkdownDisplayToken);
			}
		}

		flushDetailGroup();

		return displayTokens;
	};

	const getDetailTextContent = (token: MarkdownDetailToken) => {
		return decode(token?.text || '')
			.replace(/<summary>.*?<\/summary>/gi, '')
			.trim();
	};

	$: displayTokens = getDisplayTokens(tokens);

	const exportTableToCSVHandler = (token: MarkdownTableToken, tokenIdx = 0) => {
		console.log('Exporting table to CSV');

		// Extract header row text, decode HTML entities, and escape for CSV.
		const header = token.header.map(
			(headerCell) => `"${decode(headerCell.text).replace(/"/g, '""')}"`
		);

			// Create an array for rows that will hold the mapped cell text.
			const rows = token.rows.map((row) =>
				row.map((cell) => {
					// Map tokens into a single text
					const cellContent = cell.tokens
						.map((cellToken) => ('text' in cellToken ? cellToken.text : ''))
						.join('');
				// Decode HTML entities and escape double quotes, wrap in double quotes
				return `"${decode(cellContent).replace(/"/g, '""')}"`;
			})
		);

		// Combine header and rows
		const csvData = [header, ...rows];

		// Join the rows using commas (,) as the separator and rows using newline (\n).
		const csvContent = csvData.map((row) => row.join(',')).join('\n');

		// Log rows and CSV content to ensure everything is correct.
		console.log(csvData);
		console.log(csvContent);

		// To handle Unicode characters, you need to prefix the data with a BOM:
		const bom = '\uFEFF'; // BOM for UTF-8

		// Create a new Blob prefixed with the BOM to ensure proper Unicode encoding.
		const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=UTF-8' });

		// Use FileSaver.js's saveAs function to save the generated CSV file.
		saveAs(blob, `table-${id}-${tokenIdx}.csv`);
	};
</script>

<!-- {JSON.stringify(tokens)} -->
{#each displayTokens as token, tokenIdx (tokenIdx)}
	{#if token.type === 'hr'}
		<hr class=" border-gray-100/30 dark:border-gray-850/30" />
	{:else if token.type === 'heading'}
		{@const headingToken = token as MarkdownHeadingToken}
		<svelte:element this={headerComponent(headingToken.depth)} dir="auto">
			<MarkdownInlineTokens
				id={`${id}-${tokenIdx}-h`}
				tokens={headingToken.tokens ?? []}
				{done}
				{sourceIds}
				{onSourceClick}
			/>
		</svelte:element>
	{:else if token.type === 'code'}
		{@const codeToken = token as MarkdownCodeToken}
		{#if codeToken.raw.includes('```')}
			<CodeBlock
				id={`${id}-${tokenIdx}`}
				collapsed={$settings?.collapseCodeBlocks ?? false}
				token={codeToken as any}
				lang={codeToken?.lang ?? ''}
				code={codeToken?.text ?? ''}
				{attributes}
				{save}
				{preview}
				edit={editCodeBlock}
				stickyButtonsClassName={topPadding ? 'top-10' : 'top-0'}
				onSave={(value) => {
					onSave({
						raw: codeToken.raw,
						oldContent: codeToken.text,
						newContent: value
					});
				}}
				{onUpdate}
				{onPreview}
			/>
		{:else}
			{codeToken.text}
		{/if}
	{:else if token.type === 'table'}
		{@const tableToken = token as MarkdownTableToken}
		<div class="relative w-full group mb-2">
			<div class="scrollbar-hidden relative overflow-x-auto max-w-full">
				<table
					class=" w-full text-sm text-start text-gray-500 dark:text-gray-400 max-w-full rounded-xl"
					dir="auto"
				>
					<thead
						class="text-xs text-gray-700 uppercase bg-white dark:bg-gray-900 dark:text-gray-400 border-none"
					>
						<tr class="">
							{#each tableToken.header as header, headerIdx}
								<th
									scope="col"
									class="px-2.5! py-2! cursor-pointer border-b border-gray-100! dark:border-gray-800!"
									style={tableToken.align[headerIdx] ? `text-align: ${tableToken.align[headerIdx]}` : ''}
								>
									<div class="gap-1.5 text-start">
										<div class="shrink-0 break-normal">
											<MarkdownInlineTokens
												id={`${id}-${tokenIdx}-header-${headerIdx}`}
												tokens={header.tokens ?? []}
												{done}
												{sourceIds}
												{onSourceClick}
											/>
										</div>
									</div>
								</th>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each tableToken.rows as row, rowIdx}
							<tr class="bg-white dark:bg-gray-900 text-xs">
								{#each row ?? [] as cell, cellIdx}
								<td
										class="px-3! py-2! text-gray-900 dark:text-white w-max {tableToken.rows.length -
											1 ===
										rowIdx
											? ''
											: 'border-b border-gray-50! dark:border-gray-850!'}"
										style={tableToken.align[cellIdx] ? `text-align: ${tableToken.align[cellIdx]}` : ''}
									>
				<div class="break-normal">
											<MarkdownInlineTokens
												id={`${id}-${tokenIdx}-row-${rowIdx}-${cellIdx}`}
												tokens={cell.tokens ?? []}
												{done}
												{sourceIds}
												{onSourceClick}
											/>
										</div>
									</td>
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<div class=" absolute top-1 right-1.5 z-20 invisible group-hover:visible flex gap-0.5">
				<Tooltip content={$i18n.t('Copy')}>
							<button
							class="p-1 rounded-lg bg-transparent transition"
							on:click={(e) => {
								e.stopPropagation();
								copyToClipboard(token.raw.trim(), null, $settings?.copyFormatted ?? false);
							}}
					>
						<Clipboard className=" size-3.5" strokeWidth="1.5" />
					</button>
				</Tooltip>

				<Tooltip content={$i18n.t('Export to CSV')}>
						<button
							class="p-1 rounded-lg bg-transparent transition"
							on:click={(e) => {
								e.stopPropagation();
								exportTableToCSVHandler(tableToken, tokenIdx);
							}}
					>
						<Download className=" size-3.5" strokeWidth="1.5" />
					</button>
				</Tooltip>
			</div>
			</div>
		{:else if token.type === 'blockquote'}
			{@const blockquoteToken = token as MarkdownBlockquoteToken}
			{@const alert = alertComponent(blockquoteToken)}
			{#if alert}
				<AlertRenderer token={blockquoteToken as any} {alert} />
			{:else}
				<blockquote dir="auto">
					<svelte:self
						id={`${id}-${tokenIdx}`}
						tokens={blockquoteToken.tokens ?? []}
						{done}
						{editCodeBlock}
						{onTaskClick}
					{sourceIds}
					{onSourceClick}
				/>
			</blockquote>
		{/if}
		{:else if token.type === 'list'}
			{@const listToken = token as MarkdownListToken}
			{#if listToken.ordered}
				<ol start={listToken.start || 1} dir="auto">
					{#each listToken.items as item, itemIdx}
						<li class="text-start">
							{#if item?.task}
								<input
								class=" translate-y-[1px] -translate-x-1 flex-shrink-0"
								type="checkbox"
								checked={item.checked}
								on:change={(e) => {
									onTaskClick({
										id: id,
										token: token,
										tokenIdx: tokenIdx,
										item: item,
										itemIdx: itemIdx,
											checked: (e.currentTarget as HTMLInputElement).checked
									});
								}}
							/>
						{/if}

							<svelte:self
								id={`${id}-${tokenIdx}-${itemIdx}`}
								tokens={item.tokens ?? []}
								top={listToken.loose ?? false}
								{done}
								{editCodeBlock}
								{onTaskClick}
							{sourceIds}
							{onSourceClick}
						/>
					</li>
				{/each}
			</ol>
			{:else}
				<ul dir="auto" class="">
					{#each listToken.items as item, itemIdx}
						<li class="text-start {item?.task ? 'flex -translate-x-6.5 gap-3 ' : ''}">
							{#if item?.task}
								<input
								class="flex-shrink-0"
								type="checkbox"
								checked={item.checked}
								on:change={(e) => {
									onTaskClick({
										id: id,
										token: token,
										tokenIdx: tokenIdx,
										item: item,
										itemIdx: itemIdx,
										checked: (e.currentTarget as HTMLInputElement).checked
									});
								}}
							/>

								<div>
									<svelte:self
										id={`${id}-${tokenIdx}-${itemIdx}`}
										tokens={item.tokens ?? []}
										top={listToken.loose ?? false}
										{done}
										{editCodeBlock}
										{onTaskClick}
									{sourceIds}
									{onSourceClick}
								/>
							</div>
						{:else}
							<svelte:self
								id={`${id}-${tokenIdx}-${itemIdx}`}
								tokens={item.tokens}
								top={token.loose}
								{done}
								{editCodeBlock}
								{onTaskClick}
								{sourceIds}
								{onSourceClick}
							/>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	{:else if token.type === 'detail_group'}
		{@const detailGroupToken = token as MarkdownDetailGroupToken}
		<ConsecutiveDetailsGroup
			id={`${id}-${tokenIdx}-detail-group`}
			tokens={detailGroupToken.items}
			messageDone={done}
		>
			<div slot="content" class="space-y-1">
				{#each detailGroupToken.items as detailToken, detailIdx}
					{@const textContent = getDetailTextContent(detailToken)}

					{#if detailToken?.attributes?.type === 'tool_calls'}
						<ToolCallDisplay
							id={`${id}-${tokenIdx}-${detailIdx}-tc`}
							attributes={detailToken.attributes}
							grouped={true}
							open={false}
							className="w-full space-y-1"
						/>
					{:else if textContent.length > 0}
							<Collapsible
								title={detailToken.summary as any}
								open={$settings?.expandDetails ?? false}
								attributes={detailToken?.attributes as any}
								messageDone={done}
								className="w-full space-y-1"
						>
							<div class="mb-1.5" slot="content">
								<svelte:self
									id={`${id}-${tokenIdx}-${detailIdx}-d`}
									tokens={marked.lexer(decode(detailToken.text))}
									attributes={detailToken?.attributes}
									{done}
									{editCodeBlock}
									{onTaskClick}
									{sourceIds}
									{onSourceClick}
								/>
							</div>
						</Collapsible>
					{:else}
							<Collapsible
								title={detailToken.summary as any}
								open={false}
								disabled={true}
								attributes={detailToken?.attributes as any}
								messageDone={done}
								className="w-full space-y-1"
						/>
					{/if}
				{/each}
			</div>
		</ConsecutiveDetailsGroup>
		{:else if token.type === 'details'}
		{@const detailToken = token as MarkdownDetailToken}
		{@const textContent = getDetailTextContent(detailToken)}

		{#if detailToken?.attributes?.type === 'tool_calls'}
			<!-- Tool calls have dedicated handling with ToolCallDisplay component -->
			<ToolCallDisplay
				id={`${id}-${tokenIdx}-tc`}
				attributes={detailToken.attributes}
				open={false}
				className="w-full space-y-1"
			/>
		{:else if textContent.length > 0}
			<Collapsible
				title={detailToken.summary as any}
				open={$settings?.expandDetails ?? false}
				attributes={detailToken?.attributes as any}
				messageDone={done}
				className="w-full space-y-1"
			>
				<div class=" mb-1.5" slot="content">
					<svelte:self
						id={`${id}-${tokenIdx}-d`}
						tokens={marked.lexer(decode(detailToken.text))}
						attributes={detailToken?.attributes}
						{done}
						{editCodeBlock}
						{onTaskClick}
						{sourceIds}
						{onSourceClick}
					/>
				</div>
			</Collapsible>
		{:else}
			<Collapsible
				title={detailToken.summary as any}
				open={false}
				disabled={true}
				attributes={detailToken?.attributes as any}
				messageDone={done}
				className="w-full space-y-1"
			/>
		{/if}
	{:else if token.type === 'html'}
		<HtmlToken {id} {token} />
	{:else if token.type === 'iframe'}
		{@const iframeToken = token as MarkdownIframeToken}
			<iframe
				src="{WEBUI_BASE_URL}/api/v1/files/{iframeToken.fileId}/content"
				title={iframeToken.fileId?.toString() ?? null}
				width="100%"
				frameborder="0"
				on:load={(e) => {
					try {
						const iframe = e.currentTarget as HTMLIFrameElement;
						iframe.style.height = iframe.contentWindow!.document.body.scrollHeight + 20 + 'px';
					} catch {}
				}}
			></iframe>
	{:else if token.type === 'paragraph'}
		{@const paragraphToken = token as MarkdownParagraphToken}
		{#if paragraphTag == 'span'}
			<span dir="auto">
				<MarkdownInlineTokens
					id={`${id}-${tokenIdx}-p`}
					tokens={paragraphToken.tokens ?? []}
					{done}
					{sourceIds}
					{onSourceClick}
				/>
			</span>
		{:else}
			<p dir="auto">
				<MarkdownInlineTokens
					id={`${id}-${tokenIdx}-p`}
					tokens={paragraphToken.tokens ?? []}
					{done}
					{sourceIds}
					{onSourceClick}
				/>
			</p>
		{/if}
	{:else if token.type === 'text'}
		{@const textToken = token as MarkdownTextToken}
		{#if top}
			<p>
				{#if textToken.tokens}
					<MarkdownInlineTokens
						id={`${id}-${tokenIdx}-t`}
						tokens={textToken.tokens ?? []}
						{done}
						{sourceIds}
						{onSourceClick}
					/>
				{:else}
					{unescapeHtml(textToken.text)}
				{/if}
			</p>
		{:else if textToken.tokens}
			<MarkdownInlineTokens
				id={`${id}-${tokenIdx}-p`}
				tokens={textToken.tokens ?? []}
				{done}
				{sourceIds}
				{onSourceClick}
			/>
		{:else}
			{unescapeHtml(textToken.text)}
		{/if}
	{:else if token.type === 'inlineKatex'}
		{#if token.text}
			<KatexRenderer content={token.text} displayMode={token?.displayMode ?? false} />
		{/if}
	{:else if token.type === 'blockKatex'}
		{#if token.text}
			<KatexRenderer content={token.text} displayMode={token?.displayMode ?? false} />
		{/if}
	{:else if token.type === 'colonFence'}
		{@const colonFenceToken = token as MarkdownColonFenceToken}
		<ColonFenceBlock
			id={`${id}-${tokenIdx}`}
			token={colonFenceToken as any}
			{tokenIdx}
			{done}
			{editCodeBlock}
			{sourceIds}
			{onTaskClick}
			{onSourceClick}
		/>
	{:else if token.type === 'space'}
		<div class="my-2"></div>
	{:else}
		{console.log('Unknown token', token)}
	{/if}
{/each}
