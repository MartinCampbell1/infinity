import React from "react";

import { PlaneAiHomeSurface } from "@/components/frontdoor/plane-ai-home-surface";
import { PlaneAiShell } from "@/components/shell/plane-ai-shell";
import { readShellRouteScopeFromQueryRecord } from "@/lib/route-scope";
import { getExecutionKernelAvailability } from "@/lib/server/orchestration/batches";
import { buildClaudeDesignFrontdoorRecentRuns } from "@/lib/server/orchestration/claude-design-presentation";

type FrontdoorSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function FrontdoorPage({
  searchParams,
}: {
  searchParams?: FrontdoorSearchParams;
}) {
  const params = searchParams ? await searchParams : undefined;
  const routeScope = readShellRouteScopeFromQueryRecord(params);
  const kernelAvailability = await getExecutionKernelAvailability();
  const recentRuns = buildClaudeDesignFrontdoorRecentRuns(routeScope);

  return (
    <PlaneAiShell>
      <PlaneAiHomeSurface
        recentRuns={recentRuns}
        routeScope={routeScope}
        kernelAvailability={kernelAvailability}
      />
    </PlaneAiShell>
  );
}
