import Link from "next/link";

import {
  buildExecutionContinuityScopeHref,
  buildExecutionTaskGraphScopeHref,
  type ShellRouteScope,
} from "@/lib/route-scope";
import type {
  AssemblyRecord,
  DeliveryRecord,
  VerificationRunRecord,
} from "@/lib/server/control-plane/contracts/orchestration";

function facts(label: string, value: string | null | undefined) {
  return (
    <div className="rounded-2xl bg-white/[0.03] p-4">
      <div className="text-xs uppercase tracking-[0.14em] text-white/42">
        {label}
      </div>
      <div className="mt-1 text-sm text-white/78">{value || "n/a"}</div>
    </div>
  );
}

function titleCase(value: string | null | undefined) {
  if (!value) {
    return "Unknown";
  }

  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

export function DeliverySummary({
  delivery,
  verification,
  assembly,
  taskGraphId,
  routeScope,
}: {
  delivery: DeliveryRecord;
  verification: VerificationRunRecord | null;
  assembly: AssemblyRecord | null;
  taskGraphId?: string | null;
  routeScope?: Partial<ShellRouteScope> | null;
}) {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">
      <header className="space-y-3">
        <div className="text-xs uppercase tracking-[0.2em] text-white/42">
          Execution
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-white">
            Delivery Summary
          </h1>
          <p className="max-w-3xl text-sm leading-6 text-white/58">
            Final operator-facing handoff for a verified initiative with the
            explicit artifact bundle, runnable localhost result, and handoff
            packet kept separate.
          </p>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        {facts("Delivery", `${delivery.id} · ${delivery.status}`)}
        {facts("Verification", verification ? `${verification.id} · ${verification.overallStatus}` : null)}
        {facts("Assembly", assembly ? `${assembly.id} · ${assembly.status}` : null)}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
          <div className="text-xs uppercase tracking-[0.16em] text-white/42">
            Artifact bundle
          </div>
          <div className="mt-3 text-sm text-white">
            {delivery.localOutputPath ? "Materialized" : "Pending"}
          </div>
          <div className="mt-3 text-sm leading-6 text-white/68">
            {delivery.localOutputPath ?? "No artifact bundle is available yet."}
          </div>
          <div className="mt-3 text-xs text-white/48">
            Delivery manifest: {delivery.manifestPath ?? "pending"}
          </div>
        </div>

        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
          <div className="text-xs uppercase tracking-[0.16em] text-white/42">
            Runnable localhost result
          </div>
          <div className="mt-3 text-sm text-white">
            {delivery.launchProofAt ? "Runnable" : titleCase(delivery.status)}
          </div>
          <div className="mt-3 break-all font-mono text-[11px] leading-6 text-white/68">
            {delivery.command ?? "Launch command not available yet"}
          </div>
          <div className="mt-3 text-xs text-white/48">
            Launch manifest: {delivery.launchManifestPath ?? "pending"}
          </div>
          <div className="mt-1 text-xs text-white/48">
            Launch proof: {delivery.launchProofUrl ?? "not proven yet"}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {delivery.previewUrl ? (
              <Link
                className="rounded-full border border-white/12 px-4 py-2 text-sm text-white/78"
                href={delivery.previewUrl}
              >
                Open preview
              </Link>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
          <div className="text-xs uppercase tracking-[0.16em] text-white/42">
            Handoff packet
          </div>
          <div className="mt-3 text-sm text-white">
            {delivery.launchProofAt ? "Evidence ready" : "Partial"}
          </div>
          <div className="mt-3 text-sm leading-6 text-white/68">
            {delivery.handoffNotes ?? "No handoff guidance available yet."}
          </div>
          <div className="mt-3 text-xs text-white/48">
            Verification: {verification ? `${verification.id} · ${verification.overallStatus}` : "pending"}
          </div>
          <div className="mt-1 text-xs text-white/48">
            Assembly: {assembly ? `${assembly.id} · ${assembly.status}` : "pending"}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
        <div className="text-xs uppercase tracking-[0.16em] text-white/42">
          Summary
        </div>
        <p className="mt-3 text-sm leading-7 text-white/68">
          {delivery.resultSummary}
        </p>
      </section>

      {taskGraphId ? (
        <section className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
          <Link
            className="mr-3 rounded-full border border-white/12 px-4 py-2 text-sm text-white/78"
            href={buildExecutionContinuityScopeHref(delivery.initiativeId, routeScope)}
          >
            Open run
          </Link>
          <Link
            className="rounded-full border border-white/12 px-4 py-2 text-sm text-white/78"
            href={buildExecutionTaskGraphScopeHref(taskGraphId, routeScope, {
              initiativeId: delivery.initiativeId,
            })}
          >
            Open task graph
          </Link>
        </section>
      ) : null}
    </main>
  );
}
