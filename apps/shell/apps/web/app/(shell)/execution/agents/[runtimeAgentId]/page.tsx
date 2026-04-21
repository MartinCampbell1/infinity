import React from "react";

import { ExecutionAgentWorkspace } from "@/components/execution/execution-agent-workspace";
import { buildExecutionAgentSnapshot } from "@/lib/execution-agent";
import { readShellRouteScopeFromQueryRecord } from "@/lib/route-scope";

function decodeRouteParam(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

type ExecutionAgentSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function ExecutionAgentPage({
  params,
  searchParams,
}: {
  params: Promise<{ runtimeAgentId: string }>;
  searchParams?: ExecutionAgentSearchParams;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const runtimeAgentId = decodeRouteParam(resolvedParams.runtimeAgentId);
  const routeScope = readShellRouteScopeFromQueryRecord(resolvedSearchParams);
  const initialSnapshot = await buildExecutionAgentSnapshot(runtimeAgentId);

  return (
    <ExecutionAgentWorkspace
      runtimeAgentId={runtimeAgentId}
      initialSnapshot={initialSnapshot}
      routeScope={routeScope}
    />
  );
}
