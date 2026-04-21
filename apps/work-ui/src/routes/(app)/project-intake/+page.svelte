<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';

	import HermesEmbeddedWorkspaceFrame from '$lib/components/hermes/workspace/HermesEmbeddedWorkspaceFrame.svelte';
	import { founderosHostContext } from '$lib/founderos/bridge';
	import { founderosLaunchContext } from '$lib/founderos';
	import { buildFounderosScopedHref } from '$lib/founderos/navigation';
	import { resolveFounderosShellOrigin } from '$lib/founderos/shell-origin';
	import { user } from '$lib/stores';
	import { createOrchestrationBrief } from '$lib/apis/orchestration/briefs';
	import { createOrchestrationInitiative } from '$lib/apis/orchestration/initiatives';
	import { buildInitialBriefCreateRequest, buildInitiativeCreateRequest } from '$lib/orchestration/intake';
	import type { InitiativePriority } from '$lib/apis/orchestration/types';

	let title = '';
	let userRequest = '';
	let requestedBy = '';
	let requestedByTouched = false;
	let priority: InitiativePriority = 'normal';
	let saving = false;
	let errorMessage = '';

	$: shellOrigin = resolveFounderosShellOrigin(
		$founderosLaunchContext,
		browser ? window.location.origin : null
	);
	$: workspaceSessionId = $founderosHostContext?.sessionId ?? null;
	$: derivedRequestedBy =
		$user?.name?.trim() ||
		$user?.email?.trim() ||
		$founderosHostContext?.accountLabel?.trim() ||
		$founderosHostContext?.accountId?.trim() ||
		'operator';
	$: if (!requestedByTouched) {
		requestedBy = derivedRequestedBy;
	}
	$: metaItems = [
		$founderosHostContext?.projectName ?? 'Infinity',
		$founderosHostContext?.accountLabel ?? $founderosHostContext?.accountId ?? 'shell orchestration'
	];

	const submit = async () => {
		saving = true;
		errorMessage = '';

		try {
			const initiativePayload = buildInitiativeCreateRequest({
				title,
				userRequest,
				requestedBy,
				priority,
				workspaceSessionId
			});
			const initiativeResponse = await createOrchestrationInitiative(initiativePayload, {
				shellOrigin
			});

			const briefResponse = await createOrchestrationBrief(
				buildInitialBriefCreateRequest({
					initiativeId: initiativeResponse.initiative.id,
					userRequest: initiativeResponse.initiative.userRequest,
					authoredBy: 'hermes-intake'
				}),
				{ shellOrigin }
			);

			await goto(
				buildFounderosScopedHref(
					`/project-brief/${encodeURIComponent(briefResponse.brief.id)}`,
					$founderosLaunchContext,
					{
						initiative_id: initiativeResponse.initiative.id
					}
				)
			);
		} catch (error) {
			errorMessage =
				error instanceof Error ? error.message : 'Failed to create the initiative and initial brief.';
		} finally {
			saving = false;
		}
	};
</script>

<svelte:head>
	<title>Project Intake</title>
</svelte:head>

<HermesEmbeddedWorkspaceFrame
	title="Project intake"
	subtitle="Create the initial initiative and brief when the workspace needs a direct intake path."
	badge={saving ? 'Saving' : 'Ready'}
	metaItems={metaItems}
	maxWidthClass="max-w-4xl"
>
			<div class="rounded-[24px] border border-white/8 bg-slate-900/80 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.18)]">
				<div class="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
					Launch context
				</div>
				<p class="mt-2 text-sm leading-7 text-slate-200">
					This route writes the first durable orchestration objects into the shell-owned API
					boundary and then hands the session back into the normal workspace and shell flow.
				</p>
				<p class="mt-2 font-mono text-xs text-slate-400">
					{shellOrigin || 'same-origin shell route'}
				</p>
			</div>

			<form
				class="grid gap-5 rounded-[28px] border border-white/8 bg-slate-900/80 px-5 py-5 shadow-[0_18px_40px_rgba(15,23,42,0.18)]"
				on:submit|preventDefault={submit}
			>
				<div>
					<label class="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400" for="intake-title">
						Project title
					</label>
					<input
						id="intake-title"
						class="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-slate-500"
						bind:value={title}
						placeholder="Website refresh"
					/>
				</div>

				<div>
					<label class="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400" for="intake-request">
						User request
					</label>
					<textarea
						id="intake-request"
						class="mt-2 min-h-[180px] w-full rounded-[24px] border border-white/10 bg-slate-950/80 px-4 py-3 text-sm leading-7 text-slate-100 outline-none transition focus:border-slate-500"
						bind:value={userRequest}
						placeholder="Describe the outcome you want, any constraints or deadlines, and how you'll know this project is successful."
					></textarea>
				</div>

				<div class="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px_180px]">
					<div>
						<label class="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400" for="intake-requested-by">
							Requested by
						</label>
						<input
							id="intake-requested-by"
							class="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-slate-500"
							value={requestedBy}
							on:input={(event) => {
								requestedByTouched = true;
								requestedBy = (event.currentTarget as HTMLInputElement).value;
							}}
						/>
					</div>
					<div>
						<label class="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400" for="intake-priority">
							Priority
						</label>
						<select
							id="intake-priority"
							class="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-slate-500"
							bind:value={priority}
						>
							<option value="low">Low</option>
							<option value="normal">Normal</option>
							<option value="high">High</option>
						</select>
					</div>
					<div class="flex items-end">
						<button
							type="submit"
							class="w-full rounded-full border border-sky-500/20 bg-sky-500/15 px-4 py-3 text-sm font-medium text-sky-100 transition hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-60"
							disabled={saving}
						>
							{saving ? 'Creating…' : 'Create initiative'}
						</button>
					</div>
				</div>

				{#if errorMessage}
					<div class="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
						{errorMessage}
					</div>
				{/if}
			</form>
		</HermesEmbeddedWorkspaceFrame>
