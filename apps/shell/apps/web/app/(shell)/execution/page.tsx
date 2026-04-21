import React from "react";

import { ExecutionHomeSurface } from "@/components/execution/execution-home-surface";
import { readShellRouteScopeFromQueryRecord } from "@/lib/route-scope";
import { buildApprovalRequestsDirectory } from "@/lib/server/control-plane/approvals";
import { listControlPlaneAccounts } from "@/lib/server/control-plane/accounts";
import { buildOperatorActionAuditDirectory } from "@/lib/server/control-plane/audits";
import { buildRecoveryIncidentsDirectory } from "@/lib/server/control-plane/recoveries";
import { getExecutionSessionSummaries } from "@/lib/server/control-plane/sessions";
import {
  getExecutionKernelAvailability,
  listExecutionBatches,
} from "@/lib/server/orchestration/batches";
import { listDeliveries } from "@/lib/server/orchestration/delivery";
import { listOrchestrationInitiatives } from "@/lib/server/orchestration/initiatives";

type ExecutionSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function ExecutionPage({
  searchParams,
}: {
  searchParams?: ExecutionSearchParams;
}) {
  const params = searchParams ? await searchParams : undefined;
  const routeScope = readShellRouteScopeFromQueryRecord(params);
  const [sessions, approvals, recoveries, audits, accounts, initiatives, batches, deliveries, kernelAvailability] =
    await Promise.all([
      getExecutionSessionSummaries(),
      buildApprovalRequestsDirectory(),
      buildRecoveryIncidentsDirectory(),
      buildOperatorActionAuditDirectory(),
      listControlPlaneAccounts(),
      listOrchestrationInitiatives(),
      listExecutionBatches(),
      listDeliveries(),
      getExecutionKernelAvailability(),
    ]);
  const currentInitiative =
    initiatives.find((initiative) =>
      ["clarifying", "brief_ready", "planning", "running", "assembly", "verifying"].includes(
        initiative.status
      )
    ) ??
    initiatives[0] ??
    null;
  const currentBatch =
    (currentInitiative
      ? batches.find((batch) => batch.initiativeId === currentInitiative.id)
      : null) ??
    batches[0] ??
    null;
  const currentDelivery =
    (currentInitiative
      ? deliveries.find((delivery) => delivery.initiativeId === currentInitiative.id)
      : null) ??
    deliveries[0] ??
    null;

  return (
    <ExecutionHomeSurface
      routeScope={routeScope}
      sessions={sessions}
      approvals={approvals}
      recoveries={recoveries}
      audits={audits}
      accounts={accounts}
      currentInitiative={currentInitiative}
      currentBatch={currentBatch}
      currentDelivery={currentDelivery}
      kernelAvailability={kernelAvailability}
    />
  );
}
