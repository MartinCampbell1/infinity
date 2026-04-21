import { cookies } from "next/headers";

import { ExecutionHandoffsWorkspace } from "@/components/execution/execution-handoffs-workspace";
import { buildExecutionHandoffsSnapshot } from "@/lib/execution-handoffs";
import { readShellRouteScopeFromQueryRecord } from "@/lib/route-scope";
import {
  resolveShellOperatorPreferencesSnapshot,
  SHELL_PREFERENCES_COOKIE_NAME,
} from "@/lib/shell-preferences-contract";

type ExecutionHandoffsSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function ExecutionHandoffsPage({
  searchParams,
}: {
  searchParams?: ExecutionHandoffsSearchParams;
}) {
  const params = searchParams ? await searchParams : undefined;
  const cookieStore = await cookies();
  const operatorControls = resolveShellOperatorPreferencesSnapshot(
    cookieStore.get(SHELL_PREFERENCES_COOKIE_NAME)?.value
  );
  const initialSnapshot = await buildExecutionHandoffsSnapshot();

  return (
    <ExecutionHandoffsWorkspace
      initialPreferences={operatorControls.preferences}
      initialSnapshot={initialSnapshot}
      routeScope={readShellRouteScopeFromQueryRecord(params)}
    />
  );
}
