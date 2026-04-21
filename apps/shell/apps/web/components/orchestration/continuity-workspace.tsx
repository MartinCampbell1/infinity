import type { InitiativeContinuityResponse } from "@/lib/server/control-plane/contracts/continuity";

export function ContinuityWorkspace({
  continuity,
}: {
  continuity: InitiativeContinuityResponse;
}) {
	return (
		<main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
			<header className="space-y-3">
				<div className="text-xs uppercase tracking-[0.2em] text-white/42">
					Execution / drill-down
				</div>
				<div className="space-y-2">
					<h1 className="text-3xl font-semibold text-white">
						Continuity detail
					</h1>
					<p className="max-w-3xl text-sm leading-6 text-white/58">
						Secondary shell view for auditing the durable trace from intake through
						delivery, plus the linked approvals, recoveries, and Hermes memory sidecar
						context after the primary run route is already in motion.
					</p>
				</div>
			</header>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
          <div className="text-xs uppercase tracking-[0.16em] text-white/42">
            Initiative
          </div>
          <div className="mt-2 text-lg font-medium text-white">
            {continuity.initiative.title}
          </div>
          <div className="mt-1 text-sm text-white/58">
            {continuity.initiative.status}
          </div>
        </div>
        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
          <div className="text-xs uppercase tracking-[0.16em] text-white/42">
            Approvals
          </div>
          <div className="mt-2 text-2xl font-semibold text-white">
            {continuity.relatedApprovals.length}
          </div>
        </div>
        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
          <div className="text-xs uppercase tracking-[0.16em] text-white/42">
            Recoveries
          </div>
          <div className="mt-2 text-2xl font-semibold text-white">
            {continuity.relatedRecoveries.length}
          </div>
        </div>
        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
          <div className="text-xs uppercase tracking-[0.16em] text-white/42">
            Delivery
          </div>
          <div className="mt-2 text-sm text-white/68">
            {continuity.delivery ? `${continuity.delivery.id} · ${continuity.delivery.status}` : "n/a"}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
        <div className="text-xs uppercase tracking-[0.16em] text-white/42">
          Lifecycle
        </div>
        <ul className="mt-4 space-y-3 text-sm text-white/68">
          <li>Briefs: {continuity.briefs.length}</li>
          <li>Task graphs: {continuity.taskGraphs.length}</li>
          <li>Batches: {continuity.batches.length}</li>
          <li>Assembly: {continuity.assembly ? continuity.assembly.id : "n/a"}</li>
          <li>Verification: {continuity.verification ? continuity.verification.id : "n/a"}</li>
          <li>Delivery: {continuity.delivery ? continuity.delivery.id : "n/a"}</li>
        </ul>
      </section>

      <section className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
        <div className="text-xs uppercase tracking-[0.16em] text-white/42">
          Hermes Memory Sidecar
        </div>
        <div className="mt-3 grid gap-4 md:grid-cols-3">
          <div>
            <div className="text-xs uppercase tracking-[0.14em] text-white/42">Base URL</div>
            <div className="mt-1 text-sm text-white/78">{continuity.memoryAdapter.baseUrl ?? "n/a"}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.14em] text-white/42">Health</div>
            <div className="mt-1 text-sm text-white/78">{continuity.memoryAdapter.healthPath}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.14em] text-white/42">Schema</div>
            <div className="mt-1 text-sm text-white/78">{continuity.memoryAdapter.schemaPath}</div>
          </div>
        </div>
        <p className="mt-4 text-sm leading-7 text-white/62">{continuity.memoryAdapter.note}</p>
      </section>

      <section className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
        <div className="mb-4 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm leading-6 text-white/58">
          Use this page for deep inspection, debugging, and recovery follow-through. The main
          happy path now lives in the primary run surface.
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <a
            className="rounded-full border border-white/12 px-4 py-2 text-white/78"
            href={continuity.links.approvalsHref}
          >
            Approvals
          </a>
          <a
            className="rounded-full border border-white/12 px-4 py-2 text-white/78"
            href={continuity.links.recoveriesHref}
          >
            Recoveries
          </a>
          {continuity.links.taskGraphHref ? (
            <a
              className="rounded-full border border-white/12 px-4 py-2 text-white/78"
              href={continuity.links.taskGraphHref}
            >
              Task graph
            </a>
          ) : null}
          {continuity.links.batchHref ? (
            <a
              className="rounded-full border border-white/12 px-4 py-2 text-white/78"
              href={continuity.links.batchHref}
            >
              Batch
            </a>
          ) : null}
          {continuity.links.deliveryHref ? (
            <a
              className="rounded-full border border-white/12 px-4 py-2 text-white/78"
              href={continuity.links.deliveryHref}
            >
              Delivery
            </a>
          ) : null}
        </div>
      </section>
    </main>
  );
}
