import { describe, expect, test } from "vitest";

import { parseWorkspaceMessage } from "../../lib/workspace-postmessage";

describe("workspace handoff postMessage guard", () => {
  test("accepts supported workspace bridge messages", () => {
    expect(parseWorkspaceMessage({ type: "workspace.ready" })).toEqual({
      type: "workspace.ready",
    });
    expect(
      parseWorkspaceMessage({
        type: "workspace.tool.started",
        payload: { toolName: "planner", eventId: "event-1" },
      }),
    ).toEqual({
      type: "workspace.tool.started",
      payload: { toolName: "planner", eventId: "event-1" },
    });
    expect(
      parseWorkspaceMessage({
        type: "workspace.producer.batch",
        payload: {
          producer: "workspace_runtime_bridge",
          messages: [
            {
              type: "workspace.error",
              payload: { code: "E_TOOL", message: "Tool failed" },
            },
          ],
        },
      }),
    ).toEqual({
      type: "workspace.producer.batch",
      payload: {
        producer: "workspace_runtime_bridge",
        messages: [
          {
            type: "workspace.error",
            payload: { code: "E_TOOL", message: "Tool failed" },
          },
        ],
      },
    });
  });

  test("rejects malformed workspace messages before host state can be mutated", () => {
    expect(parseWorkspaceMessage(null)).toBeNull();
    expect(parseWorkspaceMessage({ type: "founderos.bootstrap", payload: {} })).toBeNull();
    expect(parseWorkspaceMessage({ type: "workspace.tool.started" })).toBeNull();
    expect(
      parseWorkspaceMessage({
        type: "workspace.tool.completed",
        payload: { toolName: "planner", eventId: "event-1", status: "pwned" },
      }),
    ).toBeNull();
    expect(
      parseWorkspaceMessage({
        type: "workspace.error",
        payload: { code: "E_TOOL", message: "" },
      }),
    ).toBeNull();
    expect(
      parseWorkspaceMessage({
        type: "workspace.producer.batch",
        payload: {
          producer: "workspace_runtime_bridge",
          messages: [{ type: "workspace.file.opened", payload: { path: "" } }],
        },
      }),
    ).toBeNull();
  });
});
