import React from "react";

import { readShellRouteScopeFromQueryRecord } from "@/lib/route-scope";
import { ExecutionRecoveriesDirectorySurface } from "@/components/execution/control-plane-directory-surfaces";
import { buildRecoveryIncidentsDirectory } from "@/lib/server/control-plane/recoveries";
import { listControlPlaneAccounts } from "@/lib/server/control-plane/accounts";
import type { RecoveryIncidentsDirectoryFilters } from "@/lib/server/control-plane/contracts/recoveries";

type ExecutionRecoveriesSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function ExecutionRecoveriesPage({
  searchParams,
}: {
  searchParams?: ExecutionRecoveriesSearchParams;
}) {
  const params = searchParams ? await searchParams : undefined;
  const routeScope = readShellRouteScopeFromQueryRecord(params);
  const initiativeId = firstParam(params?.initiative_id);
  const filters: RecoveryIncidentsDirectoryFilters = {
    sessionId: routeScope.sessionId,
    projectId: routeScope.projectId,
    initiativeId,
    groupId: routeScope.groupId,
    accountId: routeScope.accountId,
    workspaceId: routeScope.workspaceId,
  };
  const [directory, accounts] = await Promise.all([
    buildRecoveryIncidentsDirectory(filters),
    listControlPlaneAccounts(),
  ]);

  return (
    <ExecutionRecoveriesDirectorySurface
      directory={directory}
      routeScope={routeScope}
      fallbackAccountIds={accounts.map((account) => account.id)}
    />
  );
}

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}
