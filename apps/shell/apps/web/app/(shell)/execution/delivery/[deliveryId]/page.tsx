import React from "react";
import Link from "next/link";

import { ExecutionDetailEmptyState } from "../../../../../components/execution/detail-primitives";
import { DeliverySummary } from "@/components/orchestration/delivery-summary";
import {
  buildExecutionContinuityScopeHref,
  readShellRouteScopeFromQueryRecord,
} from "@/lib/route-scope";
import { readControlPlaneState } from "@/lib/server/control-plane/state/store";

type DeliverySearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ExecutionDeliveryPage({
  params,
  searchParams,
}: {
  params: Promise<{ deliveryId: string }>;
  searchParams?: DeliverySearchParams;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const routeScope = readShellRouteScopeFromQueryRecord(resolvedSearchParams);
  const state = await readControlPlaneState();
  const delivery =
    state.orchestration.deliveries.find(
      (candidate) => candidate.id === resolvedParams.deliveryId
    ) ?? null;

  if (!delivery) {
    const initiativeId = firstParam(resolvedSearchParams?.initiative_id);
    if (initiativeId) {
      const verification =
        [...state.orchestration.verifications]
          .filter((candidate) => candidate.initiativeId === initiativeId)
          .sort((left, right) =>
            (right.finishedAt ?? right.startedAt ?? right.id).localeCompare(
              left.finishedAt ?? left.startedAt ?? left.id
            )
          )[0] ?? null;
      const failedCheck =
        verification?.checks.find((check) => check.status === "failed") ?? null;
      const continuityHref = buildExecutionContinuityScopeHref(initiativeId, routeScope);

      return (
        <main className="mx-auto flex max-w-4xl flex-col gap-5 px-6 py-8">
          <header>
            <div className="text-xs uppercase tracking-[0.2em] text-white/42">
              Delivery gate
            </div>
            <h1 className="mt-3 text-3xl font-semibold text-white">
              Delivery is not ready
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/58">
              The requested delivery was not created because the current run has
              not passed every delivery gate. Continue from the run continuity
              trace instead of treating this as a delivered result.
            </p>
          </header>
          <section className="rounded-2xl border border-amber-400/18 bg-amber-400/[0.05] p-5">
            <div className="text-xs uppercase tracking-[0.16em] text-amber-100/70">
              Failed gate
            </div>
            <div className="mt-3 font-mono text-sm text-amber-50">
              {failedCheck?.name ?? verification?.overallStatus ?? "delivery_not_created"}
            </div>
            <p className="mt-2 text-sm leading-6 text-amber-100/72">
              {failedCheck?.details ??
                "No ready delivery exists for this initiative yet."}
            </p>
          </section>
          <div className="flex flex-wrap gap-3">
            <Link
              href={continuityHref}
              className="rounded-full bg-sky-500/90 px-4 py-2 text-sm text-white"
            >
              Open continuity
            </Link>
          </div>
        </main>
      );
    }

    return (
      <ExecutionDetailEmptyState
        title="Delivery not found"
        description="The requested delivery is not present in the current shell-owned orchestration directory."
      />
    );
  }

  const verification =
    state.orchestration.verifications.find(
      (candidate) => candidate.id === delivery.verificationRunId
    ) ?? null;
  const initiative =
    state.orchestration.initiatives.find(
      (candidate) => candidate.id === delivery.initiativeId
    ) ?? null;
  const currentRun =
    state.orchestration.runs.find((candidate) => candidate.initiativeId === delivery.initiativeId) ?? null;
  const assembly =
    verification
      ? state.orchestration.assemblies.find(
          (candidate) => candidate.id === verification.assemblyId
        ) ?? null
      : null;
  const taskGraphId = delivery.taskGraphId ?? null;
  const currentHandoffPacket =
    state.orchestration.handoffPackets.find(
      (candidate) => candidate.deliveryId === delivery.id
    ) ?? null;
  const sourceWorkUnits = taskGraphId
    ? state.orchestration.workUnits.filter((workUnit) => workUnit.taskGraphId === taskGraphId)
    : [];

  return (
    <DeliverySummary
      delivery={delivery}
      initiativeTitle={initiative?.title ?? delivery.initiativeId}
      initiativePrompt={initiative?.userRequest ?? null}
      verification={verification}
      assembly={assembly}
      taskGraphId={taskGraphId}
      runId={currentRun?.id ?? null}
      handoffId={currentHandoffPacket?.id ?? null}
      sourceWorkUnits={sourceWorkUnits}
      routeScope={routeScope}
    />
  );
}

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}
