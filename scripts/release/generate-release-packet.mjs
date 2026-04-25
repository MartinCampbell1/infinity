#!/usr/bin/env node
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_OUTPUT_ROOT = "handoff-packets/release";
const MANUAL_QA_CHECKLIST_PATH = "docs/qa/manual-screenshot-checklist.md";
const REDACTED_QUERY_PARAMS = new Set([
  "access_token",
  "auth_token",
  "founderos_session_bearer",
  "launch_token",
  "token",
]);

export function parseReleasePacketArgs(argv) {
  const options = {
    outputDir: null,
    validationDir: null,
    runId: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--output-dir") {
      options.outputDir = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--validation-dir") {
      options.validationDir = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--run-id") {
      options.runId = argv[index + 1];
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (options.outputDir === "") {
    throw new Error("--output-dir requires a path.");
  }
  if (options.validationDir === "") {
    throw new Error("--validation-dir requires a path.");
  }
  if (options.runId === "") {
    throw new Error("--run-id requires a value.");
  }

  return options;
}

export function releaseRunId(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-");
}

export async function findLatestValidationDir(rootDir) {
  if (!existsSync(rootDir)) {
    throw new Error(`Validation root does not exist: ${rootDir}`);
  }

  const entries = await readdir(rootDir, { withFileTypes: true });
  const dirs = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  if (dirs.length === 0) {
    throw new Error(`No validation packets found under ${rootDir}`);
  }

  return path.join(rootDir, dirs[dirs.length - 1]);
}

export async function readJson(pathname) {
  return JSON.parse(await readFile(pathname, "utf8"));
}

export function redactUrl(rawUrl) {
  if (typeof rawUrl !== "string" || rawUrl.length === 0) {
    return null;
  }

  try {
    const parsed = new URL(rawUrl);
    for (const param of REDACTED_QUERY_PARAMS) {
      if (parsed.searchParams.has(param)) {
        parsed.searchParams.set(param, "[redacted]");
      }
    }
    return parsed.toString();
  } catch {
    return rawUrl;
  }
}

export function summarizeValidationChecks(functionalReport) {
  const checks = [];
  const addCheck = (name, status, detail = null) => {
    if (!name || !status) {
      return;
    }
    checks.push({ name, status, detail });
  };

  addCheck("functional", functionalReport.status);
  addCheck("repo_checks", functionalReport.repo_checks?.status);
  addCheck("browser_product_e2e", functionalReport.browser_product_e2e?.status);
  addCheck("critic", functionalReport.critic?.status);
  addCheck("release_readiness", functionalReport.release_readiness?.status);

  for (const check of functionalReport.checks ?? []) {
    if (!check || typeof check !== "object") {
      continue;
    }
    addCheck(check.name, check.status, check.detail ?? null);
  }

  return checks;
}

export function collectArtifactEntries(validationDir, functionalReport) {
  const artifactNames = Array.isArray(functionalReport.artifacts)
    ? functionalReport.artifacts
    : [];
  const artifacts = artifactNames.map((artifact) => ({
    label: artifact,
    path: path.resolve(validationDir, artifact),
  }));

  const browserReportPath = functionalReport.browser_product_e2e?.report_path;
  if (typeof browserReportPath === "string" && browserReportPath.length > 0) {
    artifacts.push({
      label: "browser-e2e-report",
      path: browserReportPath,
    });
  }

  return artifacts;
}

export function collectScreenshotEntries(screenshotManifest) {
  return (screenshotManifest.screenshots ?? [])
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => ({
      screen_id: entry.screen_id,
      path: entry.path,
      scenario: entry.scenario ?? null,
      url: redactUrl(entry.url),
      notes: entry.notes ?? null,
    }));
}

export function collectManualQaChecklist(repoRoot, screenshotManifest) {
  const requiredDesktop = Array.isArray(screenshotManifest.required_desktop)
    ? screenshotManifest.required_desktop
    : [];
  const requiredFailure = Array.isArray(screenshotManifest.required_failure)
    ? screenshotManifest.required_failure
    : [];
  const requiredStandalone = Array.isArray(screenshotManifest.required_standalone)
    ? screenshotManifest.required_standalone
    : [];

  return {
    label: "manual-screenshot-checklist",
    path: path.resolve(repoRoot, MANUAL_QA_CHECKLIST_PATH),
    sourceManifest: path.resolve(repoRoot, "docs/validation/screenshot-pack.json"),
    requiredDesktop,
    requiredFailure,
    requiredStandalone,
    requiredTotal:
      requiredDesktop.length + requiredFailure.length + requiredStandalone.length,
  };
}

export function gitValue(args, cwd) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    return null;
  }
  return result.stdout.trim();
}

export function collectGitMetadata(repoRoot) {
  const statusShort = gitValue(["status", "--short"], repoRoot) ?? "";
  const changedFileCount = statusShort.split("\n").filter(Boolean).length;
  return {
    commit: gitValue(["rev-parse", "HEAD"], repoRoot),
    shortCommit: gitValue(["rev-parse", "--short", "HEAD"], repoRoot),
    branch: gitValue(["branch", "--show-current"], repoRoot),
    subject: gitValue(["log", "-1", "--pretty=%s"], repoRoot),
    committedAt: gitValue(["log", "-1", "--pretty=%cI"], repoRoot),
    dirty: statusShort.length > 0,
    changedFileCount,
  };
}

export function buildReleasePacket({
  generatedAt,
  repoRoot,
  validationDir,
  functionalReport,
  screenshotManifest,
  manualQaManifest = screenshotManifest,
  git,
}) {
  const checks = summarizeValidationChecks(functionalReport);
  const screenshots = collectScreenshotEntries(screenshotManifest);
  const manualQaChecklist = collectManualQaChecklist(repoRoot, manualQaManifest);
  const artifacts = collectArtifactEntries(validationDir, functionalReport);
  const failedChecks = checks.filter((check) => check.status !== "passed");

  return {
    generatedAt,
    repoRoot,
    git,
    validation: {
      runId: functionalReport.run_id ?? path.basename(validationDir),
      validationDir,
      status: functionalReport.status ?? "unknown",
      releaseStatus: functionalReport.release_status ?? null,
      releaseReadiness: functionalReport.release_readiness ?? null,
      browserProductE2e: functionalReport.browser_product_e2e ?? null,
      critic: functionalReport.critic ?? null,
      trackedState: functionalReport.tracked_state ?? null,
    },
    checks: {
      total: checks.length,
      failed: failedChecks.length,
      entries: checks,
    },
    artifacts,
    screenshots,
    manualQaChecklist,
  };
}

export function renderReleasePacketMarkdown(packet) {
  const lines = [
    "# Infinity Release Packet",
    "",
    `Generated at: \`${packet.generatedAt}\``,
    `Repo: \`${packet.repoRoot}\``,
    "",
    "## Commit",
    "",
    `- branch: \`${packet.git.branch ?? "unknown"}\``,
    `- commit: \`${packet.git.commit ?? "unknown"}\``,
    `- short commit: \`${packet.git.shortCommit ?? "unknown"}\``,
    `- subject: ${packet.git.subject ?? "unknown"}`,
    `- committed at: \`${packet.git.committedAt ?? "unknown"}\``,
    `- dirty worktree: \`${packet.git.dirty ? "yes" : "no"}\``,
    `- changed file count: \`${packet.git.changedFileCount}\``,
    "",
    "## Validation",
    "",
    `- validation run: \`${packet.validation.runId}\``,
    `- validation dir: \`${packet.validation.validationDir}\``,
    `- functional status: \`${packet.validation.status}\``,
    `- release status: \`${packet.validation.releaseStatus ?? "unknown"}\``,
    `- release readiness: \`${packet.validation.releaseReadiness?.status ?? "unknown"}\``,
    `- browser E2E: \`${packet.validation.browserProductE2e?.status ?? "unknown"}\``,
    `- critic: \`${packet.validation.critic?.status ?? "unknown"}\``,
    "",
    "## Checks",
    "",
    `- total checks: \`${packet.checks.total}\``,
    `- non-passing checks: \`${packet.checks.failed}\``,
    "",
  ];

  for (const check of packet.checks.entries) {
    const detail = check.detail ? ` — ${check.detail}` : "";
    lines.push(`- \`${check.status}\` ${check.name}${detail}`);
  }

  lines.push("", "## Artifacts", "");
  for (const artifact of packet.artifacts) {
    lines.push(`- ${artifact.label}: \`${artifact.path}\``);
  }

  lines.push("", "## Screenshots", "");
  lines.push(`- screenshot count: \`${packet.screenshots.length}\``);
  for (const screenshot of packet.screenshots) {
    const scenario = screenshot.scenario ? ` (${screenshot.scenario})` : "";
    const url = screenshot.url ? ` url=\`${screenshot.url}\`` : "";
    lines.push(`- ${screenshot.screen_id}${scenario}: \`${screenshot.path}\`${url}`);
  }

  lines.push("", "## Manual QA Checklist", "");
  lines.push(`- checklist: \`${packet.manualQaChecklist.path}\``);
  lines.push(`- source manifest: \`${packet.manualQaChecklist.sourceManifest}\``);
  lines.push(`- required screenshots: \`${packet.manualQaChecklist.requiredTotal}\``);
  lines.push(
    `- desktop: \`${packet.manualQaChecklist.requiredDesktop.length}\`; failure: \`${packet.manualQaChecklist.requiredFailure.length}\`; standalone: \`${packet.manualQaChecklist.requiredStandalone.length}\``
  );

  lines.push("");
  return `${lines.join("\n")}\n`;
}

export function validateReleasePacket(packet) {
  const missing = [];
  if (!packet.git.commit) {
    missing.push("git commit");
  }
  if (packet.checks.total <= 0) {
    missing.push("checks");
  }
  if (packet.artifacts.length <= 0) {
    missing.push("artifacts");
  }
  if (packet.screenshots.length <= 0) {
    missing.push("screenshots");
  }
  if (!packet.manualQaChecklist?.path || packet.manualQaChecklist.requiredTotal <= 0) {
    missing.push("manual QA checklist");
  }
  if (missing.length > 0) {
    throw new Error(`Release packet is missing required evidence: ${missing.join(", ")}`);
  }
}

export async function writeReleasePacket({ repoRoot, validationDir, outputDir, generatedAt }) {
  const functionalReport = await readJson(path.join(validationDir, "functional-report.json"));
  const screenshotManifest = await readJson(path.join(validationDir, "screenshot-manifest.json"));
  const manualQaManifest = await readJson(path.join(repoRoot, "docs", "validation", "screenshot-pack.json"));
  const packet = buildReleasePacket({
    generatedAt,
    repoRoot,
    validationDir: path.resolve(validationDir),
    functionalReport,
    screenshotManifest,
    manualQaManifest,
    git: collectGitMetadata(repoRoot),
  });
  validateReleasePacket(packet);

  await mkdir(outputDir, { recursive: true });
  const jsonPath = path.join(outputDir, "release-packet.json");
  const markdownPath = path.join(outputDir, "release-packet.md");
  await writeFile(jsonPath, `${JSON.stringify(packet, null, 2)}\n`, "utf8");
  await writeFile(markdownPath, renderReleasePacketMarkdown(packet), "utf8");
  return {
    jsonPath,
    markdownPath,
    checks: packet.checks.total,
    screenshots: packet.screenshots.length,
    artifacts: packet.artifacts.length,
  };
}

async function main() {
  const repoRoot = process.cwd();
  const options = parseReleasePacketArgs(process.argv.slice(2));
  const runId = options.runId ?? releaseRunId();
  const validationDir = options.validationDir
    ? path.resolve(options.validationDir)
    : await findLatestValidationDir(path.join(repoRoot, "handoff-packets", "validation"));
  const outputDir = path.resolve(options.outputDir ?? path.join(DEFAULT_OUTPUT_ROOT, runId));
  const result = await writeReleasePacket({
    repoRoot,
    validationDir,
    outputDir,
    generatedAt: new Date().toISOString(),
  });

  console.log(
    `Wrote release packet to ${result.markdownPath} (${result.checks} checks, ${result.artifacts} artifacts, ${result.screenshots} screenshots).`
  );
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
