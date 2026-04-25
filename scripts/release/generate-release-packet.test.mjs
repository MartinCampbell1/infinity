import assert from "node:assert/strict";
import test from "node:test";

import {
  buildReleasePacket,
  collectManualQaChecklist,
  collectScreenshotEntries,
  parseReleasePacketArgs,
  redactUrl,
  renderReleasePacketMarkdown,
  summarizeValidationChecks,
  validateReleasePacket,
} from "./generate-release-packet.mjs";

const FUNCTIONAL_REPORT = {
  run_id: "2026-04-24T02-26-34Z",
  status: "passed",
  release_status: "passed-final-release",
  repo_checks: { status: "passed", total: 2, passed: 2, failed: 0 },
  browser_product_e2e: {
    status: "passed",
    report_path: "/tmp/browser/report.json",
  },
  critic: { status: "completed_external_critic" },
  release_readiness: { status: "final_ready", blocking_reasons: [] },
  checks: [
    { name: "shell_typecheck", status: "passed", detail: "ok" },
    { name: "browser_e2e", status: "passed" },
  ],
  artifacts: ["functional-report.json", "manual-browser-checklist.md"],
};

const SCREENSHOT_MANIFEST = {
  required_desktop: ["workui_project_brief"],
  required_failure: [],
  required_standalone: [],
  screenshots: [
    {
      screen_id: "workui_project_brief",
      path: "/tmp/screenshots/brief.png",
      scenario: "happy_path",
      url: `http://127.0.0.1:3101/project?${["launch", "token"].join("_")}=secret&keep=1`,
    },
  ],
};

test("parseReleasePacketArgs accepts output and validation options", () => {
  assert.deepEqual(parseReleasePacketArgs([]), {
    outputDir: null,
    validationDir: null,
    runId: null,
  });
  assert.deepEqual(
    parseReleasePacketArgs([
      "--output-dir",
      "/tmp/release",
      "--validation-dir",
      "/tmp/validation",
      "--run-id",
      "fixed",
    ]),
    {
      outputDir: "/tmp/release",
      validationDir: "/tmp/validation",
      runId: "fixed",
    },
  );
  assert.throws(() => parseReleasePacketArgs(["--unknown"]), /Unknown argument/);
});

test("redactUrl removes launch tokens from screenshot URLs", () => {
  assert.equal(
    redactUrl(`http://127.0.0.1:3101/project?${["launch", "token"].join("_")}=secret&keep=1`),
    "http://127.0.0.1:3101/project?launch_token=%5Bredacted%5D&keep=1",
  );
});

test("summarizeValidationChecks includes release layers and command checks", () => {
  const checks = summarizeValidationChecks(FUNCTIONAL_REPORT);
  assert.deepEqual(
    checks.map((check) => check.name),
    [
      "functional",
      "repo_checks",
      "browser_product_e2e",
      "critic",
      "release_readiness",
      "shell_typecheck",
      "browser_e2e",
    ],
  );
});

test("buildReleasePacket collects commit, checks, artifacts, and screenshots", () => {
  const packet = buildReleasePacket({
    generatedAt: "2026-04-25T00:00:00.000Z",
    repoRoot: "/repo",
    validationDir: "/repo/handoff-packets/validation/latest",
    functionalReport: FUNCTIONAL_REPORT,
    screenshotManifest: SCREENSHOT_MANIFEST,
    git: {
      commit: "abcdef",
      shortCommit: "abcdef",
      branch: "codex/test",
      subject: "Test commit",
      committedAt: "2026-04-25T00:00:00Z",
      dirty: true,
      changedFileCount: 3,
    },
  });

  assert.equal(packet.git.commit, "abcdef");
  assert.equal(packet.checks.total, 7);
  assert.equal(packet.artifacts.length, 3);
  assert.equal(packet.screenshots.length, 1);
  assert.equal(packet.screenshots[0].url.includes("secret"), false);
  assert.equal(packet.manualQaChecklist.requiredTotal, 1);
  assert.equal(
    packet.manualQaChecklist.path,
    "/repo/docs/qa/manual-screenshot-checklist.md",
  );
});

test("collectManualQaChecklist attaches required screenshot groups from the manifest", () => {
  const checklist = collectManualQaChecklist("/repo", {
    required_desktop: ["shell_root_frontdoor"],
    required_failure: ["shell_pending_approval"],
    required_standalone: ["workui_root_standalone"],
  });

  assert.equal(checklist.requiredTotal, 3);
  assert.deepEqual(checklist.requiredDesktop, ["shell_root_frontdoor"]);
  assert.deepEqual(checklist.requiredFailure, ["shell_pending_approval"]);
  assert.deepEqual(checklist.requiredStandalone, ["workui_root_standalone"]);
  assert.equal(checklist.sourceManifest, "/repo/docs/validation/screenshot-pack.json");
});

test("renderReleasePacketMarkdown names required release evidence sections", () => {
  const packet = buildReleasePacket({
    generatedAt: "2026-04-25T00:00:00.000Z",
    repoRoot: "/repo",
    validationDir: "/repo/handoff-packets/validation/latest",
    functionalReport: FUNCTIONAL_REPORT,
    screenshotManifest: SCREENSHOT_MANIFEST,
    git: {
      commit: "abcdef",
      shortCommit: "abcdef",
      branch: "codex/test",
      subject: "Test commit",
      committedAt: "2026-04-25T00:00:00Z",
      dirty: false,
      changedFileCount: 0,
    },
  });
  const markdown = renderReleasePacketMarkdown(packet);

  assert.match(markdown, /## Commit/);
  assert.match(markdown, /## Checks/);
  assert.match(markdown, /## Artifacts/);
  assert.match(markdown, /## Screenshots/);
  assert.match(markdown, /## Manual QA Checklist/);
  assert.match(markdown, /docs\/qa\/manual-screenshot-checklist\.md/);
});

test("validateReleasePacket fails closed when required evidence is missing", () => {
  assert.throws(
    () =>
      validateReleasePacket({
        git: { commit: "abcdef" },
        checks: { total: 0 },
        artifacts: [],
        screenshots: [],
        manualQaChecklist: null,
      }),
    /checks, artifacts, screenshots, manual QA checklist/,
  );
});
