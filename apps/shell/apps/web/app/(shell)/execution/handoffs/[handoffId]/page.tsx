import React from "react";

import {
  buildExecutionContinuityScopeHref,
  buildExecutionDeliveryScopeHref,
  readShellRouteScopeFromQueryRecord,
} from "@/lib/route-scope";
import {
  ExecutionDetailActionLink,
  ExecutionDetailEmptyState,
  ExecutionDetailKeyValueGrid,
  ExecutionDetailMetric,
  ExecutionDetailMetricGrid,
  ExecutionDetailPage,
  ExecutionDetailSection,
  ExecutionDetailStatusPill,
} from "../../../../../components/execution/detail-primitives";
import { readControlPlaneState } from "@/lib/server/control-plane/state/store";

type ExecutionHandoffSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function ExecutionHandoffPage({
  params,
  searchParams,
}: {
  params: Promise<{ handoffId: string }>;
  searchParams?: ExecutionHandoffSearchParams;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const routeScope = readShellRouteScopeFromQueryRecord(resolvedSearchParams);
  const state = await readControlPlaneState();

  const handoff =
    state.orchestration.handoffPackets.find(
      (candidate) => candidate.id === resolvedParams.handoffId
    ) ?? null;

  if (!handoff) {
    return (
      <ExecutionDetailEmptyState
        title="Handoff not found"
        description="The requested handoff packet is not present in the current shell-owned orchestration directory."
      />
    );
  }

  const run =
    state.orchestration.runs.find((candidate) => candidate.id === handoff.runId) ?? null;
  const delivery =
    state.orchestration.deliveries.find(
      (candidate) => candidate.id === handoff.deliveryId
    ) ?? null;

  return (
    <ExecutionDetailPage
      eyebrow="Execution"
      title="Handoff Packet"
      description="Final summary bundle emitted after preview-ready delivery. The shell keeps this packet durable and linked back to the run lifecycle."
    >
      <ExecutionDetailMetricGrid>
        <ExecutionDetailMetric label="Handoff" value={handoff.id} />
        <ExecutionDetailMetric
          label="Status"
          value={<ExecutionDetailStatusPill value={handoff.status} />}
        />
        <ExecutionDetailMetric label="Run" value={run?.title ?? handoff.runId} />
      </ExecutionDetailMetricGrid>

      <ExecutionDetailSection title="Artifacts">
        <ExecutionDetailKeyValueGrid
          columns="md:grid-cols-3"
          items={[
            { label: "Root path", value: handoff.rootPath },
            { label: "Final summary", value: handoff.finalSummaryPath },
            { label: "Manifest", value: handoff.manifestPath },
          ]}
        />
      </ExecutionDetailSection>

      <ExecutionDetailSection title="Actions">
        <div className="flex flex-wrap gap-3">
          {delivery ? (
            <ExecutionDetailActionLink
              href={buildExecutionDeliveryScopeHref(delivery.id, routeScope, {
                initiativeId: delivery.initiativeId,
              })}
            >
              Open delivery
            </ExecutionDetailActionLink>
          ) : null}
          {run ? (
            <ExecutionDetailActionLink
              href={buildExecutionContinuityScopeHref(run.initiativeId, routeScope)}
            >
              Open run
            </ExecutionDetailActionLink>
          ) : null}
        </div>
      </ExecutionDetailSection>
    </ExecutionDetailPage>
  );
}
