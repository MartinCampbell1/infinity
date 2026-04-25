import { ExecutionEventsWorkspace } from "@/components/execution/execution-events-workspace";
import { readShellRouteScopeFromQueryRecord } from "@/lib/route-scope";

type ExecutionEventsSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

function readFirstQueryValue(
  params: Record<string, string | string[] | undefined> | undefined,
  key: string,
) {
  const value = params?.[key];
  const raw = Array.isArray(value) ? value[0] : value;
  const normalized = (raw ?? "").trim();
  return normalized.length > 0 ? normalized : undefined;
}

export default async function ExecutionEventsPage({
  searchParams,
}: {
  searchParams?: ExecutionEventsSearchParams;
}) {
  const params = searchParams ? await searchParams : undefined;
  const routeScope = readShellRouteScopeFromQueryRecord(params);

  return (
    <ExecutionEventsWorkspace
      routeScope={routeScope}
      initialFilters={{
        runtimeAgentId: readFirstQueryValue(params, "runtime_agent_id"),
        orchestratorSessionId: readFirstQueryValue(params, "orchestrator_session_id"),
        initiativeId: readFirstQueryValue(params, "initiative_id"),
        orchestrator: readFirstQueryValue(params, "orchestrator"),
      }}
    />
  );
}
