import type {
  ExecutionKernelAttemptActionEnvelope,
  ExecutionKernelAttemptActionRequest,
  ExecutionKernelAttemptHeartbeatRequest,
  ExecutionKernelAttemptEnvelope,
  ExecutionKernelAttemptLeaseRequest,
  ExecutionKernelBatchEnvelope,
  ExecutionKernelHealthResponse,
  ExecutionKernelLaunchBatchRequest,
  ExecutionKernelRetryWorkUnitRequest,
} from "./multica-types";

type ExecutionKernelClientOptions = {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  serviceAuth?: ExecutionKernelServiceAuthOptions | null;
};

export type ExecutionKernelScope =
  | "kernel.batch.create"
  | "kernel.attempt.mutate"
  | "kernel.health.read";

export type ExecutionKernelServiceAuthOptions = {
  secret: string;
  issuer?: string;
  audience?: string;
  expiresInSeconds?: number;
  now?: () => Date;
};

export class ExecutionKernelRequestError extends Error {
  readonly status: number;
  readonly detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = "ExecutionKernelRequestError";
    this.status = status;
    this.detail = detail;
  }
}

export function isExecutionKernelRequestError(
  error: unknown
): error is ExecutionKernelRequestError {
  return error instanceof ExecutionKernelRequestError;
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/$/, "");
}

function base64UrlEncodeBytes(bytes: Uint8Array) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index] ?? 0);
  }
  const base64 =
    typeof btoa === "function"
      ? btoa(binary)
      : Buffer.from(bytes).toString("base64");
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlEncodeText(value: string) {
  return base64UrlEncodeBytes(new TextEncoder().encode(value));
}

async function hmacSha256(secret: string, value: string) {
  const subtle =
    globalThis.crypto?.subtle ?? (await import("node:crypto")).webcrypto.subtle;
  const encoder = new TextEncoder();
  const key = await subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return new Uint8Array(await subtle.sign("HMAC", key, encoder.encode(value)));
}

export async function signExecutionKernelServiceToken(
  options: ExecutionKernelServiceAuthOptions & { scopes: ExecutionKernelScope[] }
) {
  const secret = options.secret.trim();
  if (!secret) {
    throw new Error("Execution kernel service auth secret is required.");
  }
  const now = options.now?.() ?? new Date();
  const expiresInSeconds = options.expiresInSeconds ?? 300;
  if (expiresInSeconds <= 0) {
    throw new Error("Execution kernel service token ttl must be positive.");
  }
  const header = base64UrlEncodeText(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64UrlEncodeText(
    JSON.stringify({
      iss: options.issuer ?? "founderos-shell",
      aud: options.audience ?? "execution-kernel",
      scp: options.scopes,
      iat: Math.floor(now.getTime() / 1000),
      exp: Math.floor(now.getTime() / 1000) + expiresInSeconds,
    })
  );
  const unsigned = `${header}.${payload}`;
  const signature = base64UrlEncodeBytes(await hmacSha256(secret, unsigned));
  return `${unsigned}.${signature}`;
}

async function requestKernel<T>(
  baseUrl: string,
  path: string,
  scope: ExecutionKernelScope,
  init: RequestInit = {},
  fetchImpl: typeof fetch = fetch,
  serviceAuth?: ExecutionKernelServiceAuthOptions | null
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (serviceAuth && !headers.has("Authorization")) {
    headers.set(
      "Authorization",
      `Bearer ${await signExecutionKernelServiceToken({
        ...serviceAuth,
        scopes: [scope],
      })}`
    );
  }

  const response = await fetchImpl(`${normalizeBaseUrl(baseUrl)}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail =
      payload && typeof payload.detail === "string"
        ? payload.detail
        : `Execution kernel request failed: ${response.status}`;
    throw new ExecutionKernelRequestError(response.status, detail);
  }

  return payload as T;
}

export function createExecutionKernelClient(options: ExecutionKernelClientOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const serviceAuth = options.serviceAuth ?? null;

  return {
    getHealth() {
      return requestKernel<ExecutionKernelHealthResponse>(
        baseUrl,
        "/healthz",
        "kernel.health.read",
        { method: "GET" },
        fetchImpl,
        serviceAuth
      );
    },

    launchBatch(payload: ExecutionKernelLaunchBatchRequest) {
      return requestKernel<ExecutionKernelBatchEnvelope>(
        baseUrl,
        "/api/v1/batches",
        "kernel.batch.create",
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
        fetchImpl,
        serviceAuth
      );
    },

    getBatch(batchId: string) {
      return requestKernel<ExecutionKernelBatchEnvelope>(
        baseUrl,
        `/api/v1/batches/${encodeURIComponent(batchId)}`,
        "kernel.health.read",
        { method: "GET" },
        fetchImpl,
        serviceAuth
      );
    },

    resumeBatch(batchId: string) {
      return requestKernel<ExecutionKernelBatchEnvelope>(
        baseUrl,
        `/api/v1/batches/${encodeURIComponent(batchId)}/resume`,
        "kernel.attempt.mutate",
        { method: "POST" },
        fetchImpl,
        serviceAuth
      );
    },

    discardBatch(batchId: string) {
      return requestKernel<ExecutionKernelBatchEnvelope>(
        baseUrl,
        `/api/v1/batches/${encodeURIComponent(batchId)}/discard`,
        "kernel.attempt.mutate",
        { method: "POST" },
        fetchImpl,
        serviceAuth
      );
    },

    retryWorkUnit(batchId: string, payload: ExecutionKernelRetryWorkUnitRequest) {
      return requestKernel<ExecutionKernelAttemptActionEnvelope>(
        baseUrl,
        `/api/v1/batches/${encodeURIComponent(batchId)}/retry-work-unit`,
        "kernel.attempt.mutate",
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
        fetchImpl,
        serviceAuth
      );
    },

    acquireNextAttemptLease(batchId: string, payload: ExecutionKernelAttemptLeaseRequest) {
      return requestKernel<ExecutionKernelAttemptActionEnvelope>(
        baseUrl,
        `/api/v1/batches/${encodeURIComponent(batchId)}/lease-next`,
        "kernel.attempt.mutate",
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
        fetchImpl,
        serviceAuth
      );
    },

    getAttempt(attemptId: string) {
      return requestKernel<ExecutionKernelAttemptEnvelope>(
        baseUrl,
        `/api/v1/attempts/${encodeURIComponent(attemptId)}`,
        "kernel.health.read",
        { method: "GET" },
        fetchImpl,
        serviceAuth
      );
    },

    completeAttempt(attemptId: string) {
      return requestKernel<ExecutionKernelAttemptActionEnvelope>(
        baseUrl,
        `/api/v1/attempts/${encodeURIComponent(attemptId)}/complete`,
        "kernel.attempt.mutate",
        { method: "POST" },
        fetchImpl,
        serviceAuth
      );
    },

    failAttempt(attemptId: string, payload: ExecutionKernelAttemptActionRequest = {}) {
      return requestKernel<ExecutionKernelAttemptActionEnvelope>(
        baseUrl,
        `/api/v1/attempts/${encodeURIComponent(attemptId)}/fail`,
        "kernel.attempt.mutate",
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
        fetchImpl,
        serviceAuth
      );
    },

    heartbeatAttempt(attemptId: string, payload: ExecutionKernelAttemptHeartbeatRequest) {
      return requestKernel<ExecutionKernelAttemptActionEnvelope>(
        baseUrl,
        `/api/v1/attempts/${encodeURIComponent(attemptId)}/heartbeat`,
        "kernel.attempt.mutate",
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
        fetchImpl,
        serviceAuth
      );
    },
  };
}
