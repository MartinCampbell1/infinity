import type {
  ExecutionKernelAttemptActionEnvelope,
  ExecutionKernelAttemptActionRequest,
  ExecutionKernelAttemptEnvelope,
  ExecutionKernelBatchEnvelope,
  ExecutionKernelHealthResponse,
  ExecutionKernelLaunchBatchRequest,
} from "./multica-types";

type ExecutionKernelClientOptions = {
  baseUrl: string;
  fetchImpl?: typeof fetch;
};

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/$/, "");
}

async function requestKernel<T>(
  baseUrl: string,
  path: string,
  init: RequestInit = {},
  fetchImpl: typeof fetch = fetch
): Promise<T> {
  const response = await fetchImpl(`${normalizeBaseUrl(baseUrl)}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail =
      payload && typeof payload.detail === "string"
        ? payload.detail
        : `Execution kernel request failed: ${response.status}`;
    throw new Error(detail);
  }

  return payload as T;
}

export function createExecutionKernelClient(options: ExecutionKernelClientOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = normalizeBaseUrl(options.baseUrl);

  return {
    getHealth() {
      return requestKernel<ExecutionKernelHealthResponse>(
        baseUrl,
        "/healthz",
        { method: "GET" },
        fetchImpl
      );
    },

    launchBatch(payload: ExecutionKernelLaunchBatchRequest) {
      return requestKernel<ExecutionKernelBatchEnvelope>(
        baseUrl,
        "/api/v1/batches",
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
        fetchImpl
      );
    },

    getBatch(batchId: string) {
      return requestKernel<ExecutionKernelBatchEnvelope>(
        baseUrl,
        `/api/v1/batches/${encodeURIComponent(batchId)}`,
        { method: "GET" },
        fetchImpl
      );
    },

    getAttempt(attemptId: string) {
      return requestKernel<ExecutionKernelAttemptEnvelope>(
        baseUrl,
        `/api/v1/attempts/${encodeURIComponent(attemptId)}`,
        { method: "GET" },
        fetchImpl
      );
    },

    completeAttempt(attemptId: string) {
      return requestKernel<ExecutionKernelAttemptActionEnvelope>(
        baseUrl,
        `/api/v1/attempts/${encodeURIComponent(attemptId)}/complete`,
        { method: "POST" },
        fetchImpl
      );
    },

    failAttempt(attemptId: string, payload: ExecutionKernelAttemptActionRequest = {}) {
      return requestKernel<ExecutionKernelAttemptActionEnvelope>(
        baseUrl,
        `/api/v1/attempts/${encodeURIComponent(attemptId)}/fail`,
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
        fetchImpl
      );
    },
  };
}
