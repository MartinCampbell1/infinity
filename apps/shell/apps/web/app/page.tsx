import React from "react";

import { PlaneAiHomeSurface } from "@/components/frontdoor/plane-ai-home-surface";
import { PlaneAiShell } from "@/components/shell/plane-ai-shell";
import { readShellRouteScopeFromQueryRecord } from "@/lib/route-scope";
import { getExecutionSessionSummaries } from "@/lib/server/control-plane/sessions";
import { getExecutionKernelAvailability } from "@/lib/server/orchestration/batches";

type FrontdoorSearchParams = Promise<Record<string, string | string[] | undefined>>;
const LIVE_SESSION_STATUSES = new Set([
  "starting",
  "planning",
  "acting",
  "validating",
  "waiting_for_approval",
  "blocked",
]);

export default async function FrontdoorPage({
  searchParams,
}: {
  searchParams?: FrontdoorSearchParams;
}) {
  const params = searchParams ? await searchParams : undefined;
  const routeScope = readShellRouteScopeFromQueryRecord(params);
  const [sessions, kernelAvailability] = await Promise.all([
    getExecutionSessionSummaries(),
    getExecutionKernelAvailability(),
  ]);
  const leadSession =
    sessions.find(
      (session) =>
        !session.archived &&
        LIVE_SESSION_STATUSES.has(session.status)
    ) ??
    sessions.find((session) => !session.archived) ??
    sessions[0] ??
    null;

  return (
    <PlaneAiShell>
      <PlaneAiHomeSurface
        leadSession={leadSession}
        routeScope={routeScope}
        kernelAvailability={kernelAvailability}
      />
    </PlaneAiShell>
  );
}
