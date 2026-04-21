import React from "react";

import { ExecutionDetailEmptyState } from "../../../../../components/execution/detail-primitives";
import { DeliverySummary } from "@/components/orchestration/delivery-summary";
import { readShellRouteScopeFromQueryRecord } from "@/lib/route-scope";
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
  const state = await readControlPlaneState();
  const delivery =
    state.orchestration.deliveries.find(
      (candidate) => candidate.id === resolvedParams.deliveryId
    ) ?? null;

  if (!delivery) {
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
  const assembly =
    verification
      ? state.orchestration.assemblies.find(
          (candidate) => candidate.id === verification.assemblyId
        ) ?? null
      : null;
  const taskGraphId = delivery.taskGraphId ?? null;

  return (
    <DeliverySummary
      delivery={delivery}
      verification={verification}
      assembly={assembly}
      taskGraphId={taskGraphId}
      routeScope={readShellRouteScopeFromQueryRecord(resolvedSearchParams)}
    />
  );
}
