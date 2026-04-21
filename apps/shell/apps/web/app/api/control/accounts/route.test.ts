import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { resetControlPlaneStateForTests } from "../../../../lib/server/control-plane/state/store";
import { GET as getAccountDetail } from "./[accountId]/route";

import { GET as getAccounts } from "./route";

const ORIGINAL_CONTROL_PLANE_STATE_DIR = process.env.FOUNDEROS_CONTROL_PLANE_STATE_DIR;
const ORIGINAL_CONTROL_PLANE_DATABASE_URL = process.env.FOUNDEROS_CONTROL_PLANE_DATABASE_URL;
const ORIGINAL_EXECUTION_HANDOFF_DATABASE_URL = process.env.FOUNDEROS_EXECUTION_HANDOFF_DATABASE_URL;

let tempStateDir = "";

beforeEach(async () => {
  tempStateDir = mkdtempSync(path.join(tmpdir(), "infinity-control-plane-"));
  process.env.FOUNDEROS_CONTROL_PLANE_STATE_DIR = tempStateDir;
  delete process.env.FOUNDEROS_CONTROL_PLANE_DATABASE_URL;
  delete process.env.FOUNDEROS_EXECUTION_HANDOFF_DATABASE_URL;
  await resetControlPlaneStateForTests();
});

afterEach(async () => {
  await resetControlPlaneStateForTests();
  if (ORIGINAL_CONTROL_PLANE_STATE_DIR === undefined) {
    delete process.env.FOUNDEROS_CONTROL_PLANE_STATE_DIR;
  } else {
    process.env.FOUNDEROS_CONTROL_PLANE_STATE_DIR = ORIGINAL_CONTROL_PLANE_STATE_DIR;
  }
  if (ORIGINAL_CONTROL_PLANE_DATABASE_URL === undefined) {
    delete process.env.FOUNDEROS_CONTROL_PLANE_DATABASE_URL;
  } else {
    process.env.FOUNDEROS_CONTROL_PLANE_DATABASE_URL = ORIGINAL_CONTROL_PLANE_DATABASE_URL;
  }
  if (ORIGINAL_EXECUTION_HANDOFF_DATABASE_URL === undefined) {
    delete process.env.FOUNDEROS_EXECUTION_HANDOFF_DATABASE_URL;
  } else {
    process.env.FOUNDEROS_EXECUTION_HANDOFF_DATABASE_URL =
      ORIGINAL_EXECUTION_HANDOFF_DATABASE_URL;
  }
  if (tempStateDir) {
    rmSync(tempStateDir, { recursive: true, force: true });
    tempStateDir = "";
  }
});

describe("/api/control/accounts", () => {
  test("returns the account directory with preferred account metadata", async () => {
    const response = await getAccounts();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.storageKind).toBe("file_backed");
    expect(body.canonicalTruth).toBe("sessionId");
    expect(body.quotaTruthPolicy.canonicalSource).toBe("openai_app_server");
    expect(Array.isArray(body.accounts)).toBe(true);
    expect(body.accounts.length).toBeGreaterThanOrEqual(4);
    expect(body.preferredAccountId).toBe("account-chatgpt-01");

    const apiKeyAccount = body.accounts.find(
      (account: { id: string }) => account.id === "account-apikey-01"
    );
    expect(apiKeyAccount?.capacity?.pressure).toBe("medium");
    expect(apiKeyAccount?.capacity?.schedulable).toBe(true);
  });

  test("returns account detail metadata for a specific account", async () => {
    const response = await getAccountDetail(new Request("http://localhost/api/control/accounts/account-chatgpt-01"), {
      params: Promise.resolve({ accountId: "account-chatgpt-01" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.storageKind).toBe("file_backed");
    expect(body.source).toBe("derived");
    expect(body.account.id).toBe("account-chatgpt-01");
    expect(body.quotaTruthPolicy.canonicalSource).toBe("openai_app_server");
  });
});
