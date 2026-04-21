import { describe, expect, test } from "vitest";

import {
  DELIVERY_STATUS_FLOW,
  DELIVERY_TERMINAL_STATUSES,
  EXECUTION_BATCH_EXCEPTION_STATUSES,
  EXECUTION_BATCH_STATUS_FLOW,
  INITIATIVE_STATUS_FLOW,
  INITIATIVE_TERMINAL_STATUSES,
  ORCHESTRATION_API_ROOT,
  ORCHESTRATION_ENTITY_TYPES,
  ORCHESTRATION_ROUTE_GROUPS,
  PROJECT_BRIEF_ALTERNATE_STATUSES,
  PROJECT_BRIEF_STATUS_FLOW,
  TASK_GRAPH_STATUS_FLOW,
  TASK_GRAPH_TERMINAL_STATUSES,
  VERIFICATION_STATUS_FLOW,
  VERIFICATION_TERMINAL_STATUSES,
  WORK_UNIT_ALLOWED_TRANSITIONS,
  WORK_UNIT_EXCEPTION_STATUSES,
  WORK_UNIT_STATUS_FLOW,
} from "./orchestration";

describe("orchestration contracts", () => {
  test("locks route groups and entity families for phase rollout", () => {
    expect(ORCHESTRATION_API_ROOT).toBe("/api/control/orchestration");
    expect(ORCHESTRATION_ROUTE_GROUPS).toEqual([
      "initiatives",
      "briefs",
      "task-graphs",
      "work-units",
      "batches",
      "supervisor",
      "assembly",
      "verification",
      "delivery",
    ]);
    expect(ORCHESTRATION_ENTITY_TYPES).toEqual([
      "initiative",
      "brief",
      "task_graph",
      "work_unit",
      "attempt",
      "batch",
      "assembly",
      "verification",
      "delivery",
    ]);
  });

  test("keeps the spec-defined state-machine spines explicit", () => {
    expect(INITIATIVE_STATUS_FLOW).toEqual([
      "draft",
      "clarifying",
      "brief_ready",
      "planning",
      "running",
      "assembly",
      "verifying",
      "ready",
    ]);
    expect(INITIATIVE_TERMINAL_STATUSES).toEqual(["failed", "cancelled"]);
    expect(PROJECT_BRIEF_STATUS_FLOW).toEqual([
      "draft",
      "clarifying",
      "reviewing",
      "approved",
    ]);
    expect(PROJECT_BRIEF_ALTERNATE_STATUSES).toEqual(["superseded"]);
    expect(TASK_GRAPH_STATUS_FLOW).toEqual([
      "draft",
      "ready",
      "active",
      "completed",
    ]);
    expect(TASK_GRAPH_TERMINAL_STATUSES).toEqual(["failed"]);
  });

  test("locks orchestration branch states for execution and delivery phases", () => {
    expect(WORK_UNIT_STATUS_FLOW).toEqual([
      "queued",
      "ready",
      "dispatched",
      "running",
      "completed",
    ]);
    expect(WORK_UNIT_EXCEPTION_STATUSES).toEqual([
      "blocked",
      "retryable",
      "failed",
    ]);
    expect(WORK_UNIT_ALLOWED_TRANSITIONS).toEqual({
      queued: ["ready"],
      ready: ["dispatched"],
      dispatched: ["running", "blocked", "retryable", "failed"],
      running: ["completed", "blocked", "retryable", "failed"],
      blocked: ["retryable", "failed"],
      retryable: ["dispatched"],
      completed: [],
      failed: [],
    });
    expect(WORK_UNIT_ALLOWED_TRANSITIONS.retryable).toEqual(["dispatched"]);
    expect(WORK_UNIT_ALLOWED_TRANSITIONS.completed).toEqual([]);
    expect(WORK_UNIT_ALLOWED_TRANSITIONS.failed).toEqual([]);
    expect(EXECUTION_BATCH_STATUS_FLOW).toEqual([
      "queued",
      "dispatching",
      "running",
      "completed",
    ]);
    expect(EXECUTION_BATCH_EXCEPTION_STATUSES).toEqual(["blocked", "failed"]);
    expect(VERIFICATION_STATUS_FLOW).toEqual(["pending", "running", "passed"]);
    expect(VERIFICATION_TERMINAL_STATUSES).toEqual(["failed"]);
    expect(DELIVERY_STATUS_FLOW).toEqual(["pending", "ready", "delivered"]);
    expect(DELIVERY_TERMINAL_STATUSES).toEqual(["rejected"]);
  });
});
