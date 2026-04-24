<script lang="ts">
	import '../../app.css';
	import type { FounderosLaunchContext } from '$lib/founderos';
	import { resolveFounderosShellOrigin } from '$lib/founderos/shell-origin';

	const standaloneLaunchContext: FounderosLaunchContext = {
		enabled: false,
		embedded: false,
		projectId: null,
		sessionId: null,
		groupId: null,
		accountId: null,
		workspaceId: null,
		launchToken: null,
		hostOrigin: null,
		rawParams: {},
		launchSource: 'standalone'
	};
	const shellOrigin = resolveFounderosShellOrigin(standaloneLaunchContext);
</script>

<svelte:head>
	<title>Infinity Workspace Access</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-[#08101f] px-6 py-10 text-slate-100">
	<div class="w-full max-w-2xl rounded-[32px] border border-white/8 bg-slate-900/80 px-8 py-8 shadow-[0_24px_80px_rgba(15,23,42,0.20)]">
		<div class="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
			Embedded workspace
		</div>
		<h1 class="mt-3 text-3xl font-semibold tracking-[-0.03em] text-slate-50">
			Launch from the shell
		</h1>
		<p class="mt-4 text-sm leading-7 text-slate-300">
			This workspace needs a shell-issued launch token before it can open. Start it from FounderOS so the
			session keeps its exact project, account, and workspace context.
		</p>

		<div class="mt-6 rounded-[24px] border border-white/8 bg-slate-950/70 px-5 py-5 text-sm leading-7 text-slate-200">
			<div class="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
				Recovery
			</div>
			<div class="mt-3">
				Open the execution hub or the live session lane in FounderOS, then launch the workspace again from there.
			</div>
			<div class="mt-3 font-mono text-xs text-slate-400">{shellOrigin}</div>
		</div>

		<div class="mt-6 flex flex-wrap gap-3">
			<a
				class="rounded-full border border-sky-500/20 bg-sky-500/15 px-4 py-2.5 text-sm font-medium text-sky-100 transition hover:bg-sky-500/20"
				href={`${shellOrigin}/execution`}
			>
				Open execution hub
			</a>
			<a
				class="rounded-full border border-white/10 bg-slate-950/80 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:bg-slate-900"
				href={`${shellOrigin}/execution/sessions`}
			>
				Open live sessions
			</a>
		</div>
	</div>
</div>
