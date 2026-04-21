import { describe, expect, test } from "vitest";

import {
  executionEventIdentityKey,
  mergeExecutionEventLists,
} from "./execution-live-events";

const BASE_EVENT = {
  event: "execution_plane_run_updated",
  project_id: "project-atlas",
  project_name: "Atlas",
  status: "running",
  message: "Planner advanced to acting",
  timestamp: "2026-04-21T04:00:00.000Z",
  story_id: 7,
  agent_action_run_id: "run-001",
  orchestrator_session_id: "session-001",
  approval_id: "",
  issue_id: "",
};

describe("execution live events", () => {
  test("uses the same identity key for snapshot and live dedupe", () => {
    const snapshotEvent = { ...BASE_EVENT };
    const liveEvent = { ...BASE_EVENT };

    expect(executionEventIdentityKey(snapshotEvent)).toBe(
      executionEventIdentityKey(liveEvent)
    );

    const merged = mergeExecutionEventLists([snapshotEvent], [liveEvent]);
    expect(merged).toHaveLength(1);
  });
});
