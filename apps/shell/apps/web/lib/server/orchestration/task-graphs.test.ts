import { describe, expect, test } from "vitest";

import type { WorkUnitRecord } from "../control-plane/contracts/orchestration";
import { runnableWorkUnitIdsFromRecords } from "./task-graphs";

function unit(id: string, status: WorkUnitRecord["status"], dependencies: string[] = []): WorkUnitRecord {
  return {
    id,
    taskGraphId: "graph-1",
    title: id,
    description: id,
    executorType: "codex",
    scopePaths: ["/Users/martin/infinity/apps/shell"],
    dependencies,
    acceptanceCriteria: [],
    estimatedComplexity: "small",
    status,
    latestAttemptId: null,
    createdAt: "2026-04-20T00:00:00.000Z",
    updatedAt: "2026-04-20T00:00:00.000Z",
  };
}

describe("runnableWorkUnitIdsFromRecords", () => {
  test("unlocks final integration only after upstream work completes and keeps QA queued behind it", () => {
    const records = [
      unit("topology_frontdoor", "completed"),
      unit("workspace_launch", "completed", ["topology_frontdoor"]),
      unit("control_plane_data", "completed", ["topology_frontdoor"]),
      unit(
        "final_integration",
        "ready",
        ["workspace_launch", "control_plane_data"]
      ),
      unit("qa_release_gate", "queued", ["final_integration"]),
    ];

    expect(runnableWorkUnitIdsFromRecords(records)).toEqual(["final_integration"]);
  });
});
