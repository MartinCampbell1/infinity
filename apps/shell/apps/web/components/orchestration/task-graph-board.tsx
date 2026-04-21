"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import type { ShellRouteScope } from "@/lib/route-scope";
import {
  buildExecutionBatchScopeHref,
  buildExecutionContinuityScopeHref,
  buildExecutionEventsScopeHref,
  buildExecutionSessionsScopeHref,
  buildExecutionTaskGraphScopeHref,
} from "@/lib/route-scope";
import type { TaskGraphDetailResponse } from "@/lib/server/control-plane/contracts/orchestration";

export function TaskGraphBoard({
  detail,
  routeScope,
}: {
  detail: TaskGraphDetailResponse;
  routeScope?: Partial<ShellRouteScope> | null;
}) {
  const router = useRouter();
  const [launchState, setLaunchState] = useState<"idle" | "launching">("idle");
  const [launchError, setLaunchError] = useState<string | null>(null);
  const canLaunchBatch = detail.runnableWorkUnitIds.length > 0;

  const launchBatch = async () => {
    if (!canLaunchBatch || launchState === "launching") {
      return;
    }

    setLaunchState("launching");
    setLaunchError(null);

    try {
      const response = await fetch("/api/control/orchestration/batches", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          taskGraphId: detail.taskGraph.id,
          workUnitIds: detail.runnableWorkUnitIds,
          concurrencyLimit: detail.runnableWorkUnitIds.length,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { batch?: { id?: string | null }; detail?: string }
        | null;

      if (!response.ok || typeof payload?.batch?.id !== "string") {
        throw new Error(
          payload?.detail ||
            `Batch launch failed: ${response.status}`
        );
      }

      router.push(
        buildExecutionBatchScopeHref(payload.batch.id, routeScope, {
          initiativeId: detail.taskGraph.initiativeId,
          taskGraphId: detail.taskGraph.id,
        })
      );
    } catch (error) {
      setLaunchError(
        error instanceof Error
          ? error.message
          : "Batch launch failed before the shell could open batch supervision."
      );
      setLaunchState("idle");
    }
  };

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <header className="space-y-3">
        <div className="text-xs uppercase tracking-[0.2em] text-white/42">
          Execution
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-white">
            Task Graph Inspection
          </h1>
          <p className="max-w-3xl text-sm leading-6 text-white/58">
            Inspect the planner output, linked brief, and current runnable work
            units without leaving the shell-owned control plane.
          </p>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
          <div className="text-xs uppercase tracking-[0.16em] text-white/42">
            Initiative
          </div>
          <div className="mt-2 text-lg font-medium text-white">
            {detail.initiative?.title ?? detail.taskGraph.initiativeId}
          </div>
          <div className="mt-1 text-sm text-white/58">
            {detail.initiative?.status ?? "unknown"}
          </div>
        </div>
        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
          <div className="text-xs uppercase tracking-[0.16em] text-white/42">
            Brief
          </div>
          <div className="mt-2 text-sm leading-6 text-white/68">
            {detail.brief?.summary ?? "No linked brief summary."}
          </div>
        </div>
        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
          <div className="text-xs uppercase tracking-[0.16em] text-white/42">
            Graph
          </div>
          <div className="mt-2 text-lg font-medium text-white">
            {detail.taskGraph.status}
          </div>
          <div className="mt-1 text-sm text-white/58">
            {detail.runnableWorkUnitIds.length} runnable node
            {detail.runnableWorkUnitIds.length === 1 ? "" : "s"}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
        <div className="flex flex-wrap gap-3 text-sm">
          <a
            className="rounded-full bg-sky-500/90 px-4 py-2 text-white"
            href={buildExecutionTaskGraphScopeHref(detail.taskGraph.id, routeScope, {
              initiativeId: detail.taskGraph.initiativeId,
            })}
          >
            Refresh graph
          </a>
          <a
            className="rounded-full border border-white/12 px-4 py-2 text-white/78"
            href={buildExecutionEventsScopeHref(routeScope, {
              initiativeId: detail.taskGraph.initiativeId,
            })}
          >
            Events for initiative
          </a>
          <a
            className="rounded-full border border-white/12 px-4 py-2 text-white/78"
            href={buildExecutionContinuityScopeHref(detail.taskGraph.initiativeId, routeScope)}
          >
            Continuity
          </a>
          <a
            className="rounded-full border border-white/12 px-4 py-2 text-white/78"
            href={buildExecutionSessionsScopeHref(routeScope)}
          >
            Sessions
          </a>
          <button
            className="rounded-full border border-white/12 px-4 py-2 text-white/78 disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            onClick={launchBatch}
            disabled={!canLaunchBatch || launchState === "launching"}
          >
            {launchState === "launching"
              ? "Launching batch"
              : canLaunchBatch
                ? `Launch batch (${detail.runnableWorkUnitIds.length})`
                : "Launch batch"}
          </button>
        </div>
        <div className="mt-4 text-sm text-white/58">
          {canLaunchBatch
            ? `${detail.runnableWorkUnitIds.length} runnable work unit${detail.runnableWorkUnitIds.length === 1 ? "" : "s"} are ready for the next shell batch.`
            : "No runnable work units are available yet. Complete existing shell batches or finish remaining dependencies first."}
        </div>
        {launchError ? (
          <div className="mt-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {launchError}
          </div>
        ) : null}
      </section>

      {detail.notes.length > 0 ? (
        <section className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
          <div className="text-xs uppercase tracking-[0.16em] text-white/42">
            Planner metadata
          </div>
          <ul className="mt-4 space-y-2 text-sm text-white/58">
            {detail.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
        <div className="text-xs uppercase tracking-[0.16em] text-white/42">
          Work Units
        </div>
        <div className="mt-4 grid gap-4">
          {detail.workUnits.map((workUnit) => {
            const runnable = detail.runnableWorkUnitIds.includes(workUnit.id);
            return (
              <article
                key={workUnit.id}
                className="rounded-2xl border border-white/8 bg-white/[0.03] p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">
                      {workUnit.title}
                    </div>
                    <div className="mt-1 text-sm text-white/58">
                      {workUnit.description}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs uppercase tracking-[0.12em] text-white/42">
                    <span>{workUnit.executorType}</span>
                    <span>{workUnit.status}</span>
                    {runnable ? <span>runnable</span> : null}
                  </div>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <div>
                    <div className="text-xs uppercase tracking-[0.12em] text-white/42">
                      Scope
                    </div>
                    <ul className="mt-2 space-y-1 text-sm text-white/68">
                      {workUnit.scopePaths.map((scopePath) => (
                        <li key={scopePath}>{scopePath}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.12em] text-white/42">
                      Dependencies
                    </div>
                    <ul className="mt-2 space-y-1 text-sm text-white/68">
                      {workUnit.dependencies.length > 0 ? (
                        workUnit.dependencies.map((dependencyId) => (
                          <li key={dependencyId}>{dependencyId}</li>
                        ))
                      ) : (
                        <li>None</li>
                      )}
                    </ul>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.12em] text-white/42">
                      Acceptance
                    </div>
                    <ul className="mt-2 space-y-1 text-sm text-white/68">
                      {workUnit.acceptanceCriteria.map((criterion) => (
                        <li key={criterion}>{criterion}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
