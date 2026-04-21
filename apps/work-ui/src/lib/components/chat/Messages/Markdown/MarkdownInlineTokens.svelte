<script lang="ts">
	import DOMPurify from 'dompurify';
	import { toast } from 'svelte-sonner';

	import type { Token } from 'marked';
	import { getContext } from 'svelte';
	import { goto } from '$app/navigation';

	const i18n = getContext('i18n');

	import { WEBUI_BASE_URL } from '$lib/constants';
	import { copyToClipboard, unescapeHtml } from '$lib/utils';

	import Image from '$lib/components/common/Image.svelte';
	import KatexRenderer from './KatexRenderer.svelte';
	import Source from './Source.svelte';
	import HtmlToken from './HTMLToken.svelte';
	import TextToken from './MarkdownInlineTokens/TextToken.svelte';
	import CodespanToken from './MarkdownInlineTokens/CodespanToken.svelte';
	import MentionToken from './MarkdownInlineTokens/MentionToken.svelte';
	import NoteLinkToken from './MarkdownInlineTokens/NoteLinkToken.svelte';
	import SourceToken from './SourceToken.svelte';

	type MarkdownInlineMentionToken = Token & {
		type: 'mention';
		id: string;
		triggerChar?: string;
		label?: string;
	};

	type MarkdownInlineLinkToken = Token & {
		type: 'link';
		href: string;
		title?: string;
		text: string;
		tokens?: Token[];
	};

	type MarkdownInlineImageToken = Token & {
		type: 'image';
		href: string;
		text: string;
	};

	type MarkdownInlineStrongToken = Token & {
		type: 'strong';
		tokens?: Token[];
	};

	type MarkdownInlineEmToken = Token & {
		type: 'em';
		tokens?: Token[];
	};

	type MarkdownInlineDelToken = Token & {
		type: 'del';
		tokens?: Token[];
	};

	type MarkdownInlineCodespanToken = Token & {
		type: 'codespan';
		text: string;
	};

	type MarkdownInlineIframeToken = Token & {
		type: 'iframe';
		fileId?: string | number;
	};

	type MarkdownInlineCitationToken = Token & {
		type: 'citation';
		raw: string;
		ids: number[];
		citationIdentifiers?: string[];
	};

	export let id: string;
	export let done = true;
	export let tokens: Token[] = [];
	export let sourceIds: string[] = [];
	export let onSourceClick: Function = () => {};

	/**
	 * Check if a URL is a same-origin note link and return the note ID if so.
	 */
	const getNoteIdFromHref = (href: string): string | null => {
		try {
			const url = new URL(href, window.location.origin);
			if (url.origin === window.location.origin) {
				const match = url.pathname.match(/^\/notes\/([^/]+)$/);
				if (match) {
					return match[1];
				}
			}
		} catch {
			// Invalid URL
		}
		return null;
	};

	/**
	 * Handle link clicks - intercept same-origin app URLs for in-app navigation
	 */
	const handleLinkClick = (e: MouseEvent, href: string) => {
		try {
			const url = new URL(href, window.location.origin);
			// Check if same origin and an in-app route
			if (
				url.origin === window.location.origin &&
				(url.pathname.startsWith('/notes/') ||
					url.pathname.startsWith('/c/') ||
					url.pathname.startsWith('/channels/'))
			) {
				e.preventDefault();
				goto(url.pathname + url.search + url.hash);
			}
		} catch {
			// Invalid URL, let browser handle it
		}
	};
</script>

{#each tokens as token, tokenIdx (tokenIdx)}
	{#if token.type === 'escape'}
		{unescapeHtml(token.text)}
	{:else if token.type === 'html'}
		<HtmlToken {id} {token} />
	{:else if token.type === 'link'}
		{@const linkToken = token as MarkdownInlineLinkToken}
		{@const noteId = getNoteIdFromHref(linkToken.href)}
		{#if noteId}
			<NoteLinkToken {noteId} href={linkToken.href} />
		{:else if linkToken.tokens}
			<a
				href={linkToken.href}
				target="_blank"
				rel="nofollow"
				title={linkToken.title}
				on:click={(e) => handleLinkClick(e, linkToken.href)}
			>
				<svelte:self id={`${id}-a`} tokens={linkToken.tokens ?? []} {onSourceClick} {done} />
			</a>
		{:else}
			<a
				href={linkToken.href}
				target="_blank"
				rel="nofollow"
				title={linkToken.title}
				on:click={(e) => handleLinkClick(e, linkToken.href)}>{linkToken.text}</a
			>
		{/if}
	{:else if token.type === 'image'}
		{@const imageToken = token as MarkdownInlineImageToken}
		<Image src={imageToken.href} alt={imageToken.text} />
	{:else if token.type === 'strong'}
		{@const strongToken = token as MarkdownInlineStrongToken}
		<strong><svelte:self id={`${id}-strong`} tokens={strongToken.tokens ?? []} {onSourceClick} /></strong>
	{:else if token.type === 'em'}
		{@const emToken = token as MarkdownInlineEmToken}
		<em><svelte:self id={`${id}-em`} tokens={emToken.tokens ?? []} {onSourceClick} /></em>
	{:else if token.type === 'codespan'}
		<CodespanToken token={token as MarkdownInlineCodespanToken} {done} />
	{:else if token.type === 'br'}
		<br />
	{:else if token.type === 'del'}
		{@const delToken = token as MarkdownInlineDelToken}
		<del><svelte:self id={`${id}-del`} tokens={delToken.tokens ?? []} {onSourceClick} /></del>
	{:else if token.type === 'inlineKatex'}
		{#if token.text}
			<KatexRenderer content={token.text} displayMode={false} />
		{/if}
	{:else if token.type === 'iframe'}
		{@const iframeToken = token as MarkdownInlineIframeToken}
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
	{:else if token.type === 'mention'}
		<MentionToken token={token as MarkdownInlineMentionToken} />
	{:else if token.type === 'footnote'}
		{@html DOMPurify.sanitize(
			`<sup class="footnote-ref footnote-ref-text">${token.escapedText}</sup>`
		) || ''}
	{:else if token.type === 'citation'}
		{@const citationToken = token as MarkdownInlineCitationToken}
		{#if (sourceIds ?? []).length > 0}
			<SourceToken {id} token={citationToken} {sourceIds} onClick={onSourceClick} />
		{:else}
			<TextToken token={citationToken} {done} />
		{/if}
	{:else if token.type === 'text'}
		<TextToken token={token} {done} />
	{/if}
{/each}
