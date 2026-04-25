import { existsSync } from "node:fs";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import {
  getControlPlaneStatePath,
  resetControlPlaneStateForTests,
} from "../../../lib/server/control-plane/state/store";
import { createIsolatedControlPlaneStateDir } from "../../../lib/server/control-plane/state/test-helpers";
import {
  ARTIFACT_OBJECT_BACKEND_ENV_KEY,
  ARTIFACT_SIGNED_URL_BASE_ENV_KEY,
  ARTIFACT_SIGNING_SECRET_ENV_KEY,
  ARTIFACT_STORAGE_URI_PREFIX_ENV_KEY,
  ARTIFACT_STORE_MODE_ENV_KEY,
  CANONICAL_SHELL_PUBLIC_ORIGIN_ENV_KEY,
  CANONICAL_WORK_UI_BASE_URL_ENV_KEY,
  CONTROL_PLANE_DATABASE_URL_ENV_KEY,
  CONTROL_PLANE_OPERATOR_TOKEN_ENV_KEY,
  CONTROL_PLANE_SERVICE_TOKEN_ENV_KEY,
  DEPLOYMENT_ENV_KEY,
  EXECUTION_KERNEL_BASE_URL_ENV_KEY,
  EXECUTION_KERNEL_SERVICE_AUTH_SECRET_ENV_KEY,
  EXTERNAL_DELIVERY_MODE_ENV_KEY,
  FOUNDEROS_VERCEL_BLOB_READ_WRITE_TOKEN_ENV_KEY,
  GITHUB_BASE_BRANCH_ENV_KEY,
  GITHUB_REPOSITORY_ENV_KEY,
  GITHUB_TOKEN_ENV_KEY,
  PRIVILEGED_API_ALLOWED_ORIGINS_ENV_KEY,
  STRICT_ROLLOUT_ENV_KEY,
  VERCEL_GIT_REPO_ID_ENV_KEY,
  VERCEL_PROJECT_ID_ENV_KEY,
  VERCEL_TOKEN_ENV_KEY,
  WORKSPACE_LAUNCH_SECRET_ENV_KEY,
  WORKSPACE_SESSION_GRANT_SECRET_ENV_KEY,
  WORKSPACE_SESSION_TOKEN_SECRET_ENV_KEY,
} from "../../../lib/server/control-plane/workspace/rollout-config";
import { GET as getAccounts } from "./accounts/route";
import { POST as postAccountQuotas } from "./accounts/quotas/route";
import { POST as postApprovalRequest } from "./execution/approvals/route";
import { POST as postApprovalRespond } from "./execution/approvals/[approvalId]/respond/route";
import { POST as postRecoveryAction } from "./execution/recoveries/[recoveryId]/route";
import { POST as postAssembly } from "./orchestration/assembly/route";
import { POST as postBrief } from "./orchestration/briefs/route";
import { GET as getPreview } from "./orchestration/previews/[previewId]/route";
import { POST as postSupervisorAction } from "./orchestration/supervisor/actions/route";

const ORIGINAL_ENV = { ...process.env };
const OPERATOR_ACTOR_HEADERS = {
  "x-founderos-actor-type": "operator",
  "x-founderos-actor-id": "operator-storage-policy-test",
  "x-founderos-tenant-id": "tenant-test",
  "x-founderos-request-id": "request-storage-policy-test",
  "x-founderos-auth-boundary": "token",
};
const SERVICE_ACTOR_HEADERS = {
  "x-founderos-actor-type": "service",
  "x-founderos-actor-id": "service-storage-policy-test",
  "x-founderos-tenant-id": "tenant-test",
  "x-founderos-request-id": "request-storage-policy-test",
  "x-founderos-auth-boundary": "token",
};

let restoreStateDir: (() => void) | null = null;

function configureProductionControlPlaneEnv() {
  process.env[DEPLOYMENT_ENV_KEY] = "production";
  process.env[STRICT_ROLLOUT_ENV_KEY] = "1";
  process.env[CONTROL_PLANE_DATABASE_URL_ENV_KEY] =
    "postgres://127.0.0.1:1/infinity_control_plane";
  process.env[CANONICAL_SHELL_PUBLIC_ORIGIN_ENV_KEY] =
    "https://shell.infinity.example";
  process.env[CANONICAL_WORK_UI_BASE_URL_ENV_KEY] =
    "https://work.infinity.example";
  process.env[EXECUTION_KERNEL_BASE_URL_ENV_KEY] =
    "https://kernel.infinity.example";
  process.env[EXECUTION_KERNEL_SERVICE_AUTH_SECRET_ENV_KEY] = "kernel-secret";
  process.env[PRIVILEGED_API_ALLOWED_ORIGINS_ENV_KEY] =
    "https://shell.infinity.example,https://work.infinity.example";
  process.env[WORKSPACE_LAUNCH_SECRET_ENV_KEY] = "launch-secret";
  process.env[WORKSPACE_SESSION_GRANT_SECRET_ENV_KEY] = "grant-secret";
  process.env[WORKSPACE_SESSION_TOKEN_SECRET_ENV_KEY] = "session-secret";
  process.env[CONTROL_PLANE_OPERATOR_TOKEN_ENV_KEY] = "operator-secret";
  process.env[CONTROL_PLANE_SERVICE_TOKEN_ENV_KEY] = "service-secret";
  process.env[ARTIFACT_STORE_MODE_ENV_KEY] = "object";
  process.env[ARTIFACT_OBJECT_BACKEND_ENV_KEY] = "vercel_blob";
  process.env[ARTIFACT_STORAGE_URI_PREFIX_ENV_KEY] =
    "vercel-blob://infinity-production-storage-policy";
  process.env[ARTIFACT_SIGNED_URL_BASE_ENV_KEY] =
    "https://artifacts.infinity.example/download";
  process.env[ARTIFACT_SIGNING_SECRET_ENV_KEY] = "artifact-secret";
  process.env[FOUNDEROS_VERCEL_BLOB_READ_WRITE_TOKEN_ENV_KEY] = "blob-token";
  process.env[EXTERNAL_DELIVERY_MODE_ENV_KEY] = "github_vercel";
  process.env[GITHUB_TOKEN_ENV_KEY] = "github-token";
  process.env[GITHUB_REPOSITORY_ENV_KEY] = "founderos/infinity";
  process.env[GITHUB_BASE_BRANCH_ENV_KEY] = "main";
  process.env[VERCEL_TOKEN_ENV_KEY] = "vercel-token";
  process.env[VERCEL_PROJECT_ID_ENV_KEY] = "prj_founderos_infinity";
  process.env[VERCEL_GIT_REPO_ID_ENV_KEY] = "123456789";
}

async function expectStorageUnavailable(
  response: Response,
  expectedExtras: Record<string, unknown> = { accepted: false },
) {
  const body = await response.json();

  expect(response.status).toBe(503);
  expect(body).toEqual(
    expect.objectContaining({
      code: "control_plane_storage_unavailable",
      readOnly: true,
      degraded: true,
      storageKind: "unknown",
      integrationState: "degraded",
      ...expectedExtras,
      storagePolicy: expect.objectContaining({
        deploymentEnv: "production",
        mode: "normal",
        localFileAllowed: false,
        fileStateImportAllowed: false,
        postgresRequired: true,
        degradedMode: "read_only",
      }),
    }),
  );
  expect(existsSync(getControlPlaneStatePath())).toBe(false);
}

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  restoreStateDir = createIsolatedControlPlaneStateDir().restore;
  configureProductionControlPlaneEnv();
  resetControlPlaneStateForTests();
});

afterEach(() => {
  resetControlPlaneStateForTests();
  restoreStateDir?.();
  restoreStateDir = null;
  process.env = { ...ORIGINAL_ENV };
});

describe("production control-plane storage policy across mutation routes", () => {
  test("account directory read returns 503 degraded without file fallback", async () => {
    await expectStorageUnavailable(await getAccounts(), {});
  });

  test("preview read returns 503 degraded before falling back to local state", async () => {
    await expectStorageUnavailable(
      await getPreview(
        new Request(
          "https://shell.infinity.example/api/control/orchestration/previews/preview-storage-policy",
        ),
        { params: Promise.resolve({ previewId: "preview-storage-policy" }) },
      ),
      {},
    );
  });

  test("approval create returns 503 read-only degraded without file fallback", async () => {
    await expectStorageUnavailable(
      await postApprovalRequest(
        new Request("https://shell.infinity.example/api/control/execution/approvals", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            id: "approval-storage-policy",
            sessionId: "session-storage-policy",
            projectId: "project-storage-policy",
            projectName: "Storage Policy",
            requestKind: "command",
            title: "Storage policy approval",
            summary: "Should fail before local file fallback.",
          }),
        }),
      ),
    );
  });

  test("approval response returns 503 read-only degraded without file fallback", async () => {
    await expectStorageUnavailable(
      await postApprovalRespond(
        new Request(
          "https://shell.infinity.example/api/control/execution/approvals/approval-001/respond",
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              ...OPERATOR_ACTOR_HEADERS,
            },
            body: JSON.stringify({ decision: "approve_once" }),
          },
        ),
        { params: Promise.resolve({ approvalId: "approval-001" }) },
      ),
    );
  });

  test("quota ingest returns 503 read-only degraded without file fallback", async () => {
    await expectStorageUnavailable(
      await postAccountQuotas(
        new Request("https://shell.infinity.example/api/control/accounts/quotas", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...SERVICE_ACTOR_HEADERS,
          },
          body: JSON.stringify({
            producer: "openai_app_server",
            snapshot: {
              accountId: "account-chatgpt-02",
              authMode: "chatgptAuthTokens",
              source: "openai_app_server",
              observedAt: "2026-04-24T00:00:00.000Z",
              buckets: [],
              raw: null,
            },
            summary: "Storage unavailable should fail closed.",
          }),
        }),
      ),
    );
  });

  test("recovery action returns 503 read-only degraded without file fallback", async () => {
    await expectStorageUnavailable(
      await postRecoveryAction(
        new Request(
          "https://shell.infinity.example/api/control/execution/recoveries/recovery-001",
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              ...OPERATOR_ACTOR_HEADERS,
            },
            body: JSON.stringify({
              actionKind: "failover",
              targetAccountId: "account-chatgpt-03",
            }),
          },
        ),
        { params: Promise.resolve({ recoveryId: "recovery-001" }) },
      ),
    );
  });

  test("supervisor action returns 503 read-only degraded without file fallback", async () => {
    await expectStorageUnavailable(
      await postSupervisorAction(
        new Request(
          "https://shell.infinity.example/api/control/orchestration/supervisor/actions",
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              ...OPERATOR_ACTOR_HEADERS,
            },
            body: JSON.stringify({
              actionKind: "complete_attempt",
              batchId: "batch-storage-policy",
              attemptId: "attempt-storage-policy",
              workUnitId: "work-unit-storage-policy",
            }),
          },
        ),
      ),
    );
  });

  test("project brief creation returns 503 read-only degraded without file fallback", async () => {
    await expectStorageUnavailable(
      await postBrief(
        new Request("https://shell.infinity.example/api/control/orchestration/briefs", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            initiativeId: "initiative-storage-policy",
            summary: "Should fail before local file fallback.",
            goals: [],
            nonGoals: [],
            constraints: [],
            assumptions: [],
            acceptanceCriteria: [],
            repoScope: [],
            deliverables: [],
            clarificationLog: [],
            authoredBy: "storage-policy-test",
          }),
        }),
      ),
    );
  });

  test("assembly creation returns 503 read-only degraded without file fallback", async () => {
    await expectStorageUnavailable(
      await postAssembly(
        new Request("https://shell.infinity.example/api/control/orchestration/assembly", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            initiativeId: "initiative-storage-policy",
          }),
        }),
      ),
    );
  });
});
