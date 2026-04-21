import { describe, expect, test } from "vitest";

import type {
  InitiativeRecord,
  ProjectBriefRecord,
} from "../control-plane/contracts/orchestration";
import {
  buildPlannerNotes,
  derivePlannerWorkstreams,
  planTaskGraphFromBrief,
} from "./planner";

function initiative(overrides: Partial<InitiativeRecord> = {}): InitiativeRecord {
  return {
    id: "initiative-1",
    title: "Atlas launch control plane",
    userRequest: "Build the Atlas launch frontdoor.",
    status: "planning",
    requestedBy: "martin",
    workspaceSessionId: null,
    priority: "high",
    createdAt: "2026-04-20T00:00:00.000Z",
    updatedAt: "2026-04-20T00:00:00.000Z",
    ...overrides,
  };
}

function brief(repoScope: string[], overrides: Partial<ProjectBriefRecord> = {}): ProjectBriefRecord {
  return {
    id: "brief-1",
    initiativeId: "initiative-1",
    summary: "Build the Atlas launch frontdoor.",
    goals: ["Ship one coherent product result."],
    nonGoals: [],
    constraints: [],
    assumptions: [],
    acceptanceCriteria: ["Primary run route exists."],
    repoScope,
    deliverables: ["Run surface", "Integrated product result"],
    clarificationLog: [],
    status: "approved",
    authoredBy: "hermes-intake",
    createdAt: "2026-04-20T00:00:00.000Z",
    updatedAt: "2026-04-20T00:00:00.000Z",
    ...overrides,
  };
}

describe("derivePlannerWorkstreams", () => {
  test("varies with repo scope while always keeping final integration", () => {
    const shellOnly = derivePlannerWorkstreams(
      brief(["/Users/martin/infinity/apps/shell"])
    );
    const shellAndRuntime = derivePlannerWorkstreams(
      brief([
        "/Users/martin/infinity/apps/shell",
        "/Users/martin/infinity/apps/work-ui",
        "/Users/martin/infinity/services/execution-kernel",
      ])
    );

    expect(shellOnly).toContain("final_integration");
    expect(shellOnly).toContain("shell_ui");
    expect(shellOnly).not.toContain("work_ui");
    expect(shellOnly).not.toContain("runtime_kernel");

    expect(shellAndRuntime).toContain("final_integration");
    expect(shellAndRuntime).toContain("shell_ui");
    expect(shellAndRuntime).toContain("work_ui");
    expect(shellAndRuntime).toContain("runtime_kernel");
  });
});

describe("planTaskGraphFromBrief", () => {
  test("adds a final integration unit before the QA gate", () => {
    const planned = planTaskGraphFromBrief(
      initiative(),
      brief([
        "/Users/martin/infinity/apps/shell",
        "/Users/martin/infinity/apps/work-ui",
      ])
    );

    const finalIntegration = planned.workUnits.find((unit) =>
      unit.id.endsWith("final_integration")
    );
    const qaGate = planned.workUnits.find((unit) =>
      unit.id.endsWith("qa_release_gate")
    );

    expect(finalIntegration).toBeTruthy();
    expect(qaGate).toBeTruthy();
    expect(qaGate?.dependencies).toContain(finalIntegration?.id ?? "");
    expect(finalIntegration?.dependencies.length).toBeGreaterThan(0);
  });

  test("derives critical-path and risk notes from the planned work units", () => {
    const planned = planTaskGraphFromBrief(
      initiative(),
      brief([
        "/Users/martin/infinity/apps/shell",
        "/Users/martin/infinity/apps/work-ui",
        "/Users/martin/infinity/services/execution-kernel",
      ])
    );

    const notes = buildPlannerNotes(planned.workUnits);

    expect(notes.some((note) => note.startsWith("critical path depth:"))).toBe(true);
    expect(notes.some((note) => note.includes("final integration"))).toBe(true);
    expect(notes.some((note) => note.includes("runtime kernel dependency"))).toBe(true);
  });
});
