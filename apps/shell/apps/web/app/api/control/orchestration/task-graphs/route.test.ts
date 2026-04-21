import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { resetControlPlaneStateForTests } from "../../../../../lib/server/control-plane/state/store";

import { POST as postInitiatives } from "../initiatives/route";
import { POST as postBriefs } from "../briefs/route";
import { GET as getTaskGraphDetail } from "./[taskGraphId]/route";
import { GET as getTaskGraphs, POST as postTaskGraphs } from "./route";

const ORIGINAL_CONTROL_PLANE_STATE_DIR = process.env.FOUNDEROS_CONTROL_PLANE_STATE_DIR;
const ORIGINAL_CONTROL_PLANE_DATABASE_URL = process.env.FOUNDEROS_CONTROL_PLANE_DATABASE_URL;
const ORIGINAL_EXECUTION_HANDOFF_DATABASE_URL = process.env.FOUNDEROS_EXECUTION_HANDOFF_DATABASE_URL;

let tempStateDir = "";

beforeEach(async () => {
  tempStateDir = mkdtempSync(path.join(tmpdir(), "infinity-task-graphs-"));
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

async function createApprovedBrief() {
  const initiativeResponse = await postInitiatives(
    new Request("http://localhost/api/control/orchestration/initiatives", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Atlas Factory",
        userRequest: "Build the Infinity-native project factory.",
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
        summary: "Approved brief for the project factory.",
        goals: [
          "Capture the user request",
          "Generate a deterministic execution plan",
        ],
        nonGoals: ["Batch execution"],
        constraints: ["Stay inside /Users/martin/infinity"],
        assumptions: ["Shell and work-ui remain split"],
        acceptanceCriteria: [
          "Approved brief generates a valid DAG",
          "Work units expose dependencies and acceptance criteria",
        ],
        repoScope: [
          "/Users/martin/infinity/apps/shell",
          "/Users/martin/infinity/apps/work-ui",
        ],
        deliverables: ["Task graph", "Work units"],
        clarificationLog: [
          {
            question: "What is in scope for this pass?",
            answer: "Planner and task-graph flow only.",
          },
        ],
        authoredBy: "droid-spec-writer",
        status: "approved",
      }),
    })
  );
  const briefBody = await briefResponse.json();

  return {
    initiativeId,
    briefId: briefBody.brief.id as string,
  };
}

describe("/api/control/orchestration/task-graphs", () => {
  test("approved briefs stay at brief_ready until an explicit planner launch creates a deterministic DAG", async () => {
    const { initiativeId, briefId } = await createApprovedBrief();

    const listResponse = await getTaskGraphs(
      new Request(
        `http://localhost/api/control/orchestration/task-graphs?initiative_id=${initiativeId}`
      )
    );
    const listBody = await listResponse.json();

    expect(listResponse.status).toBe(200);
    expect(listBody.taskGraphs).toEqual([]);

    const detailResponse = await getTaskGraphDetail(
      new Request("http://localhost/api/control/orchestration/task-graphs/missing"),
      { params: Promise.resolve({ taskGraphId: "missing" }) }
    );
    expect(detailResponse.status).toBe(404);

    const manualCreateResponse = await postTaskGraphs(
      new Request("http://localhost/api/control/orchestration/task-graphs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ briefId }),
      })
    );
    const manualCreateBody = await manualCreateResponse.json();
    const taskGraphId = manualCreateBody.taskGraph.id as string;

    expect(manualCreateResponse.status).toBe(201);
    expect(manualCreateBody.taskGraph).toEqual(
      expect.objectContaining({
        initiativeId,
        briefId,
        status: "ready",
      })
    );
    expect(manualCreateBody.workUnits.length).toBeGreaterThanOrEqual(6);
    expect(manualCreateBody.runnableWorkUnitIds).toHaveLength(1);
    expect(
      manualCreateBody.workUnits.map((unit: { title: string }) => unit.title)
    ).toEqual(
      expect.arrayContaining([
        "Stabilize frontdoor and topology for Atlas Factory",
        "Wire shell-to-workspace launch for Atlas Factory",
        "Clean shell control-plane truth for Atlas Factory",
        "Harden orchestration lifecycle for Atlas Factory",
        "Run QA and release gates for Atlas Factory",
      ])
    );

    const launchedListResponse = await getTaskGraphs(
      new Request(
        `http://localhost/api/control/orchestration/task-graphs?initiative_id=${initiativeId}`
      )
    );
    const launchedListBody = await launchedListResponse.json();
    expect(launchedListResponse.status).toBe(200);
    expect(launchedListBody.taskGraphs).toHaveLength(1);
    expect(launchedListBody.taskGraphs[0]?.id).toBe(taskGraphId);

    const launchedDetailResponse = await getTaskGraphDetail(
      new Request(`http://localhost/api/control/orchestration/task-graphs/${taskGraphId}`),
      { params: Promise.resolve({ taskGraphId }) }
    );
    const launchedDetailBody = await launchedDetailResponse.json();
    expect(launchedDetailResponse.status).toBe(200);
    expect(launchedDetailBody.taskGraph.id).toBe(taskGraphId);
    expect(launchedDetailBody.workUnits.length).toBe(manualCreateBody.workUnits.length);
    expect(launchedDetailBody.runnableWorkUnitIds).toEqual(
      manualCreateBody.runnableWorkUnitIds
    );
    expect(launchedDetailBody.notes).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^critical path depth:/),
        expect.stringMatching(/^critical path focus:/),
        expect.stringMatching(/^concurrency groups:/),
        expect.stringMatching(/^risk flags:/),
      ])
    );
    expect(
      launchedDetailBody.workUnits.every(
        (unit: {
          executorType: string;
          acceptanceCriteria: string[];
          scopePaths: string[];
        }) =>
          unit.executorType.length > 0 &&
          unit.acceptanceCriteria.length > 0 &&
          unit.scopePaths.length > 0
      )
    ).toBe(true);
  });
});
