<!-- @ts-nocheck -->
<script lang="ts">
	// @ts-nocheck
	const signOut = () => {
		localStorage.removeItem('token');
		location.href = '/auth';
	};
</script>

<div class="fixed inset-0 z-[9999] flex items-center justify-center bg-white/30 backdrop-blur-lg dark:bg-gray-950/60">
	<div class="mx-4 max-w-md rounded-3xl border border-gray-200 bg-white p-6 text-center shadow-2xl dark:border-gray-800 dark:bg-gray-950">
		<div class="text-2xl font-medium text-gray-900 dark:text-gray-100">
			Account Activation Pending
		</div>
		<div class="mt-4 text-sm leading-6 text-gray-600 dark:text-gray-300">
			Your account is currently pending activation. Contact an administrator to continue.
		</div>
		<div class="mt-6 flex flex-col gap-3">
			<button
				type="button"
				class="rounded-full bg-gray-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
				on:click={() => {
					location.reload();
				}}
			>
				Check Again
			</button>
			<button
				type="button"
				class="text-sm text-gray-500 underline"
				on:click={signOut}
			>
				Sign Out
			</button>
		</div>
	</div>
</div>
