import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import {
  readControlPlaneState,
  resetControlPlaneStateForTests,
} from "../../../../../lib/server/control-plane/state/store";

import { POST as postInitiatives } from "../initiatives/route";
import { GET as getInitiativeDetail } from "../initiatives/[initiativeId]/route";
import { GET as getBriefDetail, PATCH as patchBrief } from "./[briefId]/route";
import { GET as getBriefs, POST as postBriefs } from "./route";

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

describe("/api/control/orchestration/briefs", () => {
  test("stores clarification loops in a brief and promotes the initiative when approved", async () => {
    const initiativeResponse = await postInitiatives(
      new Request("http://localhost/api/control/orchestration/initiatives", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "Atlas Factory",
          userRequest: "Build the Infinity-native project factory intake.",
          requestedBy: "martin",
        }),
      })
    );
    const initiativeBody = await initiativeResponse.json();
    const initiativeId = initiativeBody.initiative.id as string;

    const createResponse = await postBriefs(
      new Request("http://localhost/api/control/orchestration/briefs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          initiativeId,
          summary: "Draft the first brief for the project factory.",
          goals: ["Capture the user request", "Preserve clarification history"],
          nonGoals: ["Planner execution"],
          constraints: ["Stay inside /Users/martin/infinity"],
          assumptions: ["Hermes remains the intake layer"],
          acceptanceCriteria: ["Approved brief is durable"],
          repoScope: ["/Users/martin/infinity/apps/shell", "/Users/martin/infinity/apps/work-ui"],
          deliverables: ["Initiative record", "Brief record"],
          clarificationLog: [
            {
              question: "What is the first slice?",
              answer: "Initiative and brief flow only.",
            },
          ],
          authoredBy: "droid-spec-writer",
          status: "reviewing",
        }),
      })
    );
    const createBody = await createResponse.json();

    expect(createResponse.status).toBe(201);
    expect(createBody.brief).toEqual(
      expect.objectContaining({
        initiativeId,
        status: "reviewing",
        authoredBy: "droid-spec-writer",
      })
    );
    expect(createBody.brief.clarificationLog).toEqual([
      {
        question: "What is the first slice?",
        answer: "Initiative and brief flow only.",
      },
    ]);

    const briefId = createBody.brief.id as string;

    const listResponse = await getBriefs();
    const listBody = await listResponse.json();

    expect(listResponse.status).toBe(200);
    expect(listBody.briefs).toHaveLength(1);
    expect(listBody.briefs[0]?.id).toBe(briefId);

    const detailResponse = await getBriefDetail(
      new Request(`http://localhost/api/control/orchestration/briefs/${briefId}`),
      { params: Promise.resolve({ briefId }) }
    );
    const detailBody = await detailResponse.json();

    expect(detailResponse.status).toBe(200);
    expect(detailBody.brief.id).toBe(briefId);
    expect(detailBody.initiative.id).toBe(initiativeId);

    const approveResponse = await patchBrief(
      new Request(`http://localhost/api/control/orchestration/briefs/${briefId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          status: "approved",
          summary: "Approved brief for the project factory.",
          clarificationLog: [
            {
              question: "What is the first slice?",
              answer: "Initiative and brief flow only.",
            },
            {
              question: "Should planner work ship now?",
              answer: "No, keep it for Phase 2.",
            },
          ],
        }),
      }),
      { params: Promise.resolve({ briefId }) }
    );
    const approveBody = await approveResponse.json();

    expect(approveResponse.status).toBe(200);
    expect(approveBody.brief.status).toBe("approved");
    expect(approveBody.brief.summary).toBe("Approved brief for the project factory.");
    expect(approveBody.initiative.status).toBe("brief_ready");
    expect(approveBody.taskGraph).toBeNull();

    const initiativeDetailResponse = await getInitiativeDetail(
      new Request(
        `http://localhost/api/control/orchestration/initiatives/${initiativeId}`
      ),
      { params: Promise.resolve({ initiativeId }) }
    );
    const initiativeDetailBody = await initiativeDetailResponse.json();

    expect(initiativeDetailResponse.status).toBe(200);
    expect(initiativeDetailBody.initiative.status).toBe("brief_ready");
    expect(initiativeDetailBody.briefs).toEqual([
      expect.objectContaining({
        id: briefId,
        status: "approved",
      }),
    ]);
  });

  test("persists a blocked run event when the execution kernel is unavailable", async () => {
    process.env.FOUNDEROS_EXECUTION_KERNEL_BASE_URL = "http://127.0.0.1:65530";

    const initiativeResponse = await postInitiatives(
      new Request("http://localhost/api/control/orchestration/initiatives", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "Kernel unavailable",
          userRequest: "Verify blocked runtime behavior when the local execution kernel is missing.",
          requestedBy: "martin",
        }),
      })
    );
    const initiativeBody = await initiativeResponse.json();
    const initiativeId = initiativeBody.initiative.id as string;

    const briefResponse = await postBriefs(
      new Request("http://localhost/api/control/orchestration/briefs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          initiativeId,
          summary: "Verify blocked runtime behavior when the local execution kernel is missing.",
          goals: [],
          nonGoals: [],
          constraints: [],
          assumptions: [],
          acceptanceCriteria: [],
          repoScope: [],
          deliverables: [],
          clarificationLog: [],
          authoredBy: "hermes-intake",
          status: "clarifying",
        }),
      })
    );
    const briefBody = await briefResponse.json();

    expect(briefResponse.status).toBe(201);
    expect(briefBody.brief.status).toBe("approved");

    const state = await readControlPlaneState();
    const run = state.orchestration.runs.find(
      (candidate) => candidate.initiativeId === initiativeId
    );
    const blockedEvent = state.orchestration.runEvents.find(
      (candidate) =>
        candidate.initiativeId === initiativeId &&
        candidate.kind === "runtime.unavailable"
    );

    expect(run?.currentStage).toBe("blocked");
    expect(run?.health).toBe("blocked");
    expect(blockedEvent?.summary).toContain("Execution kernel unavailable");
    expect(blockedEvent?.payload).toEqual(
      expect.objectContaining({
        dependency: "execution-kernel",
        baseUrl: "http://127.0.0.1:65530",
      })
    );
  });
});
