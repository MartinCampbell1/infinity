import { ExecutionWorkspaceHandoffSurface } from "@/components/execution/workspace-handoff-surface";
import {
  readShellRouteScopeFromQueryRecord,
  routeScopeFromExecutionBindingRef,
} from "@/lib/route-scope";
import { buildSessionWorkspaceHostContext } from "@/lib/server/control-plane/workspace/launch";
import { buildWorkspaceLaunchViewModelFromState } from "@/lib/server/control-plane/workspace";

type ExecutionWorkspaceSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

function decodeRouteParam(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function firstQueryValue(
  value: string | string[] | undefined
): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function normalizeOpenedFrom(
  value: string | undefined
):
  | "dashboard"
  | "execution_board"
  | "review"
  | "group_board"
  | "deep_link"
  | "unknown" {
  switch (value) {
    case "dashboard":
    case "execution_board":
    case "review":
    case "group_board":
    case "deep_link":
      return value;
    default:
      return "unknown";
  }
}

function inferOpenedFromFallback(scope: ReturnType<typeof routeScopeFromExecutionBindingRef>) {
  if (scope.groupId) {
    return "group_board" as const;
  }
  if (scope.sessionId) {
    return "execution_board" as const;
  }
  return "unknown" as const;
}

export default async function ExecutionWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams?: ExecutionWorkspaceSearchParams;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const sessionId = decodeRouteParam(resolvedParams.sessionId);
  const routeScope = routeScopeFromExecutionBindingRef(
    { sessionId },
    readShellRouteScopeFromQueryRecord(resolvedSearchParams)
  );
  const openedFromQuery = normalizeOpenedFrom(
    firstQueryValue(resolvedSearchParams?.opened_from)
  );
  const openedFrom =
    openedFromQuery === "unknown"
      ? inferOpenedFromFallback(routeScope)
      : openedFromQuery;
  const viewModel = await buildWorkspaceLaunchViewModelFromState(sessionId, routeScope, {
    openedFrom,
  });
  const hostContext = buildSessionWorkspaceHostContext(viewModel);

  return (
    <ExecutionWorkspaceHandoffSurface
      viewModel={viewModel}
      hostContext={hostContext}
      routeScope={routeScope}
    />
  );
}
