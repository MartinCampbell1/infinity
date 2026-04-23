import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { resetControlPlaneStateForTests } from "../../../../../lib/server/control-plane/state/store";

import { GET as getInitiativeDetail, PATCH as patchInitiative } from "./[initiativeId]/route";
import { GET as getInitiatives, POST as postInitiatives } from "./route";

const ORIGINAL_CONTROL_PLANE_STATE_DIR = process.env.FOUNDEROS_CONTROL_PLANE_STATE_DIR;
const ORIGINAL_CONTROL_PLANE_DATABASE_URL = process.env.FOUNDEROS_CONTROL_PLANE_DATABASE_URL;
const ORIGINAL_EXECUTION_HANDOFF_DATABASE_URL = process.env.FOUNDEROS_EXECUTION_HANDOFF_DATABASE_URL;

let tempStateDir = "";

beforeEach(async () => {
  tempStateDir = mkdtempSync(path.join(tmpdir(), "infinity-orchestration-"));
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

describe("/api/control/orchestration/initiatives", () => {
  test("creates, lists, and patches initiatives through the durable shell boundary", async () => {
    const createResponse = await postInitiatives(
      new Request("http://localhost/api/control/orchestration/initiatives", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "  Atlas Factory  ",
          userRequest: "  Build the Infinity-native project factory intake.  ",
          requestedBy: "  martin  ",
          priority: "high",
          workspaceSessionId: "workspace-session-atlas",
        }),
      })
    );
    const createBody = await createResponse.json();

    expect(createResponse.status).toBe(201);
    expect(createBody.canonicalTruth).toBe("sessionId");
    expect(createBody.initiative).toEqual(
      expect.objectContaining({
        title: "Atlas Factory",
        userRequest: "Build the Infinity-native project factory intake.",
        requestedBy: "martin",
        priority: "high",
        workspaceSessionId: "workspace-session-atlas",
        status: "clarifying",
      })
    );

    const initiativeId = createBody.initiative.id as string;

    const listResponse = await getInitiatives();
    const listBody = await listResponse.json();

    expect(listResponse.status).toBe(200);
    expect(listBody.initiatives).toHaveLength(1);
    expect(listBody.initiatives[0]?.id).toBe(initiativeId);

    const detailResponse = await getInitiativeDetail(
      new Request(
        `http://localhost/api/control/orchestration/initiatives/${initiativeId}`
      ),
      { params: Promise.resolve({ initiativeId }) }
    );
    const detailBody = await detailResponse.json();

    expect(detailResponse.status).toBe(200);
    expect(detailBody.initiative.id).toBe(initiativeId);
    expect(detailBody.briefs).toEqual([]);

    const patchResponse = await patchInitiative(
      new Request(
        `http://localhost/api/control/orchestration/initiatives/${initiativeId}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            title: "Atlas Factory Intake",
            priority: "normal",
          }),
        }
      ),
      { params: Promise.resolve({ initiativeId }) }
    );
    const patchBody = await patchResponse.json();

    expect(patchResponse.status).toBe(200);
    expect(patchBody.initiative).toEqual(
      expect.objectContaining({
        id: initiativeId,
        title: "Atlas Factory Intake",
        priority: "normal",
        status: "clarifying",
      })
    );
  });

  test("assigns a workspace session automatically when the caller does not provide one", async () => {
    const response = await postInitiatives(
      new Request("http://localhost/api/control/orchestration/initiatives", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "Autonomous run",
          userRequest: "Create a real workspace binding for this run.",
          requestedBy: "martin",
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.initiative.workspaceSessionId).toMatch(/^session-/);
  });
});
