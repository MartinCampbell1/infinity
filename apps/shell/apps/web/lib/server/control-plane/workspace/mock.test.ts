import { afterEach, describe, expect, test } from "vitest";

import { createIsolatedControlPlaneStateDir } from "../state/test-helpers";
import {
  buildWorkspaceLaunchSessionContext,
  buildWorkspaceLaunchViewModelFromState,
} from "./mock";

let restoreStateDir: (() => void) | null = null;

afterEach(() => {
  if (restoreStateDir) {
    restoreStateDir();
    restoreStateDir = null;
  }
});

describe("workspace launch view model", () => {
  test("derives launch context from unified session and account state", async () => {
    const { restore } = createIsolatedControlPlaneStateDir();
    restoreStateDir = restore;

    const viewModel = await buildWorkspaceLaunchViewModelFromState(
      "session-2026-04-11-002"
    );

    expect(viewModel.sessionId).toBe("session-2026-04-11-002");
    expect(viewModel.projectId).toBe("project-borealis");
    expect(viewModel.projectName).toBe("Borealis Shell");
    expect(viewModel.accountId).toBe("account-chatgpt-02");
    expect(viewModel.accountLabel).toBe("chatgpt tokens 02");
    expect(viewModel.provider).toBe("codex");
    expect(viewModel.executionMode).toBe("worktree");
    expect(viewModel.pendingApprovals).toBe(1);
    expect(viewModel.quotaState?.pressure).toBe("high");
    expect(viewModel.openedFrom).toBe("review");
    expect(viewModel.launchTokenState).toBe("signed");
    expect(viewModel.shellPublicOrigin).toBe("http://127.0.0.1:3737");
    expect(typeof viewModel.launchToken).toBe("string");
    expect(viewModel.workUiLaunchUrl).toContain("session_id=session-2026-04-11-002");
    expect(viewModel.workUiLaunchUrl).toContain("opened_from=review");
    expect(viewModel.workUiLaunchUrl).toContain(
      "host_origin=http%3A%2F%2F127.0.0.1%3A3737"
    );
    expect(viewModel.workUiLaunchUrl).toContain("launch_token=");
  });

  test("keeps fallback behavior for unknown sessions", async () => {
    const { restore } = createIsolatedControlPlaneStateDir();
    restoreStateDir = restore;

    const viewModel = await buildWorkspaceLaunchViewModelFromState(
      "session-missing",
      {
        projectId: "project-fallback",
        groupId: "group-fallback",
        accountId: "account-chatgpt-03",
        workspaceId: "workspace-fallback",
      }
    );

    expect(viewModel.projectId).toBe("project-fallback");
    expect(viewModel.groupId).toBe("group-fallback");
    expect(viewModel.accountId).toBe("account-chatgpt-03");
    expect(viewModel.workspaceId).toBe("workspace-fallback");
    expect(viewModel.status).toBe("unknown");
    expect(viewModel.quotaState?.pressure).toBe("unknown");
    expect(viewModel.launchTokenState).toBe("signed");
  });

  test("exposes a live-named session context builder for bootstrap callers", async () => {
    const { restore } = createIsolatedControlPlaneStateDir();
    restoreStateDir = restore;

    const session = await buildWorkspaceLaunchSessionContext(
      "session-2026-04-11-002"
    );

    expect(session.sessionId).toBe("session-2026-04-11-002");
    expect(session.projectId).toBe("project-borealis");
    expect(session.openedFrom).toBe("review");
  });
});
