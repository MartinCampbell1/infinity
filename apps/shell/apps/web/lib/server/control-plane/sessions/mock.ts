import {
  materializeSessionProjections,
  sortNormalizedEvents,
  type ExecutionSessionSummary,
  type NormalizedExecutionEvent,
} from "../events";
import {
  readExecutionSessionEventsFromPostgres,
  readExecutionSessionSummariesFromPostgres,
} from "../state/postgres";
import { getWiredControlPlaneDatabaseUrl, readControlPlaneState } from "../state/store";

function sortSessionSummaries(
  left: ExecutionSessionSummary,
  right: ExecutionSessionSummary
) {
  const updatedDelta = right.updatedAt.localeCompare(left.updatedAt);
  if (updatedDelta !== 0) {
    return updatedDelta;
  }
  return right.createdAt.localeCompare(left.createdAt);
}

function cloneEvents(events: NormalizedExecutionEvent[]) {
  return JSON.parse(JSON.stringify(events)) as NormalizedExecutionEvent[];
}

export async function getMockNormalizedExecutionEvents(): Promise<NormalizedExecutionEvent[]> {
  const databaseUrl = await getWiredControlPlaneDatabaseUrl();
  if (databaseUrl) {
    return readExecutionSessionEventsFromPostgres(databaseUrl);
  }
  const state = await readControlPlaneState();
  return cloneEvents(sortNormalizedEvents(state.sessions.events));
}

export const getExecutionSessionEvents = getMockNormalizedExecutionEvents;
export const getMockNormalizedExecutionEventsAsync = getMockNormalizedExecutionEvents;

export async function getMockExecutionSessionSummaries(): Promise<ExecutionSessionSummary[]> {
  const databaseUrl = await getWiredControlPlaneDatabaseUrl();
  if (databaseUrl) {
    return readExecutionSessionSummariesFromPostgres(databaseUrl);
  }
  const events = await getExecutionSessionEvents();
  return Object.values(materializeSessionProjections(events)).sort(sortSessionSummaries);
}

export const getExecutionSessionSummaries = getMockExecutionSessionSummaries;
