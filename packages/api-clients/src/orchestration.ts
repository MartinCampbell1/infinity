import type {
  CreateInitiativeRequest,
  CreateProjectBriefRequest,
  CreateTaskGraphRequest,
  CreateWorkUnitRequest,
  InitiativeDetailResponse,
  InitiativeMutationResponse,
  InitiativesDirectoryResponse,
  ProjectBriefDetailResponse,
  ProjectBriefMutationResponse,
  ProjectBriefsDirectoryResponse,
  TaskGraphDetailResponse,
  TaskGraphMutationResponse,
  TaskGraphsDirectoryResponse,
  UpdateInitiativeRequest,
  UpdateProjectBriefRequest,
  UpdateWorkUnitRequest,
  WorkUnitDetailResponse,
  WorkUnitMutationResponse,
  WorkUnitsDirectoryResponse,
} from "../../../apps/shell/apps/web/lib/server/control-plane/contracts/orchestration";

export type {
  CreateInitiativeRequest,
  CreateProjectBriefRequest,
  CreateTaskGraphRequest,
  CreateWorkUnitRequest,
  InitiativeDetailResponse,
  InitiativeMutationResponse,
  InitiativePriority,
  InitiativeRecord,
  InitiativeStatus,
  InitiativesDirectoryResponse,
  ProjectBriefClarificationEntry,
  ProjectBriefDetailResponse,
  ProjectBriefMutationResponse,
  ProjectBriefRecord,
  ProjectBriefStatus,
  ProjectBriefsDirectoryResponse,
  TaskGraphDetailResponse,
  TaskGraphMutationResponse,
  TaskGraphRecord,
  TaskGraphStatus,
  TaskGraphsDirectoryResponse,
  UpdateInitiativeRequest,
  UpdateProjectBriefRequest,
  UpdateWorkUnitRequest,
  WorkUnitDetailResponse,
  WorkUnitExecutor,
  WorkUnitMutationResponse,
  WorkUnitRecord,
  WorkUnitStatus,
  WorkUnitsDirectoryResponse,
} from "../../../apps/shell/apps/web/lib/server/control-plane/contracts/orchestration";

const ORCHESTRATION_API_ROOT = "/api/control/orchestration";

type OrchestrationRequestOptions = {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  init?: RequestInit;
};

function resolveOrchestrationUrl(path: string, baseUrl?: string) {
  const normalizedBase = baseUrl ? baseUrl.replace(/\/$/, "") : "";
  return `${normalizedBase}${ORCHESTRATION_API_ROOT}${path}`;
}

async function requestOrchestration<T>(
  path: string,
  options: OrchestrationRequestOptions = {}
): Promise<T> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(resolveOrchestrationUrl(path, options.baseUrl), {
    ...options.init,
    headers: {
      "Content-Type": "application/json",
      ...(options.init?.headers ?? {}),
    },
    cache: "no-store",
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail =
      payload && typeof payload.detail === "string"
        ? payload.detail
        : `Orchestration request failed: ${response.status}`;
    throw new Error(detail);
  }

  return payload as T;
}

export function fetchOrchestrationInitiatives(options?: OrchestrationRequestOptions) {
  return requestOrchestration<InitiativesDirectoryResponse>("/initiatives", options);
}

export function fetchOrchestrationInitiative(
  initiativeId: string,
  options?: OrchestrationRequestOptions
) {
  return requestOrchestration<InitiativeDetailResponse>(
    `/initiatives/${encodeURIComponent(initiativeId)}`,
    options
  );
}

export function createOrchestrationInitiative(
  payload: CreateInitiativeRequest,
  options?: OrchestrationRequestOptions
) {
  return requestOrchestration<InitiativeMutationResponse>("/initiatives", {
    ...options,
    init: {
      ...(options?.init ?? {}),
      method: "POST",
      body: JSON.stringify(payload),
    },
  });
}

export function updateOrchestrationInitiative(
  initiativeId: string,
  payload: UpdateInitiativeRequest,
  options?: OrchestrationRequestOptions
) {
  return requestOrchestration<InitiativeMutationResponse>(
    `/initiatives/${encodeURIComponent(initiativeId)}`,
    {
      ...options,
      init: {
        ...(options?.init ?? {}),
        method: "PATCH",
        body: JSON.stringify(payload),
      },
    }
  );
}

export function fetchOrchestrationBriefs(options?: OrchestrationRequestOptions) {
  return requestOrchestration<ProjectBriefsDirectoryResponse>("/briefs", options);
}

export function fetchOrchestrationBrief(
  briefId: string,
  options?: OrchestrationRequestOptions
) {
  return requestOrchestration<ProjectBriefDetailResponse>(
    `/briefs/${encodeURIComponent(briefId)}`,
    options
  );
}

export function createOrchestrationBrief(
  payload: CreateProjectBriefRequest,
  options?: OrchestrationRequestOptions
) {
  return requestOrchestration<ProjectBriefMutationResponse>("/briefs", {
    ...options,
    init: {
      ...(options?.init ?? {}),
      method: "POST",
      body: JSON.stringify(payload),
    },
  });
}

export function updateOrchestrationBrief(
  briefId: string,
  payload: UpdateProjectBriefRequest,
  options?: OrchestrationRequestOptions
) {
  return requestOrchestration<ProjectBriefMutationResponse>(
    `/briefs/${encodeURIComponent(briefId)}`,
    {
      ...options,
      init: {
        ...(options?.init ?? {}),
        method: "PATCH",
        body: JSON.stringify(payload),
      },
    }
  );
}

export function fetchOrchestrationTaskGraphs(
  filters?: { initiativeId?: string | null; briefId?: string | null },
  options?: OrchestrationRequestOptions
) {
  const url = new URL(resolveOrchestrationUrl("/task-graphs", options?.baseUrl), "http://localhost");
  if (filters?.initiativeId) {
    url.searchParams.set("initiative_id", filters.initiativeId);
  }
  if (filters?.briefId) {
    url.searchParams.set("brief_id", filters.briefId);
  }
  return requestOrchestration<TaskGraphsDirectoryResponse>(`${url.pathname}${url.search}`, options);
}

export function fetchOrchestrationTaskGraph(
  taskGraphId: string,
  options?: OrchestrationRequestOptions
) {
  return requestOrchestration<TaskGraphDetailResponse>(
    `/task-graphs/${encodeURIComponent(taskGraphId)}`,
    options
  );
}

export function createOrchestrationTaskGraph(
  payload: CreateTaskGraphRequest,
  options?: OrchestrationRequestOptions
) {
  return requestOrchestration<TaskGraphMutationResponse>("/task-graphs", {
    ...options,
    init: {
      ...(options?.init ?? {}),
      method: "POST",
      body: JSON.stringify(payload),
    },
  });
}

export function fetchOrchestrationWorkUnits(
  filters?: { taskGraphId?: string | null },
  options?: OrchestrationRequestOptions
) {
  const url = new URL(resolveOrchestrationUrl("/work-units", options?.baseUrl), "http://localhost");
  if (filters?.taskGraphId) {
    url.searchParams.set("task_graph_id", filters.taskGraphId);
  }
  return requestOrchestration<WorkUnitsDirectoryResponse>(`${url.pathname}${url.search}`, options);
}

export function fetchOrchestrationWorkUnit(
  workUnitId: string,
  options?: OrchestrationRequestOptions
) {
  return requestOrchestration<WorkUnitDetailResponse>(
    `/work-units/${encodeURIComponent(workUnitId)}`,
    options
  );
}

export function createOrchestrationWorkUnit(
  payload: CreateWorkUnitRequest,
  options?: OrchestrationRequestOptions
) {
  return requestOrchestration<WorkUnitMutationResponse>("/work-units", {
    ...options,
    init: {
      ...(options?.init ?? {}),
      method: "POST",
      body: JSON.stringify(payload),
    },
  });
}

export function updateOrchestrationWorkUnit(
  workUnitId: string,
  payload: UpdateWorkUnitRequest,
  options?: OrchestrationRequestOptions
) {
  return requestOrchestration<WorkUnitMutationResponse>(
    `/work-units/${encodeURIComponent(workUnitId)}`,
    {
      ...options,
      init: {
        ...(options?.init ?? {}),
        method: "PATCH",
        body: JSON.stringify(payload),
      },
    }
  );
}
