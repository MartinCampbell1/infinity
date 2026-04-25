import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { DeliverySummary } from "../components/orchestration/delivery-summary";
import type {
  AssemblyRecord,
  DeliveryRecord,
  VerificationRunRecord,
} from "../lib/server/control-plane/contracts/orchestration";

const observedAt = new Date().toISOString();
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultOutputDir = path.resolve(
  scriptDir,
  "../../../../../.local-state/p0-fe-01-readiness-screenshots",
  observedAt.replace(/[:.]/g, "-"),
);
const outputDir = path.resolve(process.argv[2] ?? defaultOutputDir);
const htmlDir = path.join(outputDir, "html");
const screenshotsDir = path.join(outputDir, "screenshots");

type Scenario = {
  id: "missing" | "local" | "production";
  strictRolloutEnv: boolean;
  delivery: DeliveryRecord;
  expectedText: string[];
  forbiddenText: string[];
};

const verification: VerificationRunRecord = {
  id: "verification-readiness-visual",
  initiativeId: "initiative-readiness-visual",
  assemblyId: "assembly-readiness-visual",
  overallStatus: "passed",
  checks: [{ name: "targeted_tests_passed", status: "passed" }],
  startedAt: observedAt,
  finishedAt: observedAt,
};

const assembly: AssemblyRecord = {
  id: "assembly-readiness-visual",
  initiativeId: "initiative-readiness-visual",
  taskGraphId: "task-graph-readiness-visual",
  inputWorkUnitIds: ["work-unit-final"],
  artifactUris: ["r2://infinity-artifacts/staging/readiness/work-unit-final.json"],
  outputLocation: "r2://infinity-artifacts/staging/readiness",
  manifestPath: "r2://infinity-artifacts/staging/readiness/manifest.json",
  summary: "Readiness visual proof fixture.",
  status: "assembled",
  createdAt: observedAt,
  updatedAt: observedAt,
};

const scenarios: Scenario[] = [
  {
    id: "missing",
    strictRolloutEnv: true,
    delivery: {
      id: "delivery-readiness-missing",
      initiativeId: "initiative-readiness-visual",
      verificationRunId: "verification-readiness-visual",
      taskGraphId: "task-graph-readiness-visual",
      resultSummary: "Delivery evidence exists, but runnable proof is missing.",
      launchProofKind: "synthetic_wrapper",
      status: "pending",
      deliveredAt: null,
    },
    expectedText: ["Missing proof", "Proof checklist", "Hosted preview proof missing"],
    forbiddenText: ["Primary handoff", "Handoff packet", "Production proof complete"],
  },
  {
    id: "local",
    strictRolloutEnv: false,
    delivery: {
      id: "delivery-readiness-local",
      initiativeId: "initiative-readiness-visual",
      verificationRunId: "verification-readiness-visual",
      taskGraphId: "task-graph-readiness-visual",
      resultSummary: "Local runnable proof exists, but production proof is missing.",
      previewUrl: "http://127.0.0.1:3737/api/control/orchestration/previews/local",
      launchProofKind: "runnable_result",
      launchProofUrl: "http://127.0.0.1:4100/index.html",
      launchProofAt: observedAt,
      launchTargetLabel: "Local preview",
      status: "ready",
      deliveredAt: observedAt,
    },
    expectedText: ["Local proof", "Local runnable proof", "Pending"],
    forbiddenText: ["Primary handoff", "Handoff packet", "Production proof complete"],
  },
  {
    id: "production",
    strictRolloutEnv: true,
    delivery: {
      id: "delivery-readiness-production",
      initiativeId: "initiative-readiness-visual",
      verificationRunId: "verification-readiness-visual",
      taskGraphId: "task-graph-readiness-visual",
      resultSummary: "Production proof is attached.",
      previewUrl: "http://127.0.0.1:3737/api/control/orchestration/previews/production",
      launchProofKind: "runnable_result",
      launchProofUrl: "http://127.0.0.1:4100/index.html",
      launchProofAt: observedAt,
      externalPullRequestUrl: "https://github.com/founderos/infinity/pull/999",
      externalPreviewUrl: "https://delivery-readiness-production.preview.infinity.example",
      externalProofManifestPath: "r2://infinity-artifacts/prod/readiness/external-proof.json",
      ciProofUri: "https://github.com/founderos/infinity/commit/readiness/checks",
      artifactStorageUri: "r2://infinity-artifacts/prod/readiness",
      signedManifestUri: "https://artifacts.infinity.example/download?key=readiness&signature=proof",
      status: "ready",
      deliveredAt: observedAt,
    },
    expectedText: ["Production proof", "Production proof complete", "Open pull request", "Handoff packet"],
    forbiddenText: ["Missing proof", "Hosted preview proof missing"],
  },
];

function renderScenario(scenario: Scenario) {
  const previousStrict = process.env.FOUNDEROS_REQUIRE_EXPLICIT_ROLLOUT_ENV;
  if (scenario.strictRolloutEnv) {
    process.env.FOUNDEROS_REQUIRE_EXPLICIT_ROLLOUT_ENV = "1";
  } else {
    delete process.env.FOUNDEROS_REQUIRE_EXPLICIT_ROLLOUT_ENV;
  }

  try {
    const body = renderToStaticMarkup(
      <DeliverySummary
        delivery={scenario.delivery}
        initiativeTitle={`Readiness ${scenario.id}`}
        initiativePrompt={`Render ${scenario.id} proof state.`}
        verification={verification}
        assembly={assembly}
        taskGraphId="task-graph-readiness-visual"
        runId="run-readiness-visual"
        handoffId={`handoff-readiness-${scenario.id}`}
        sourceWorkUnits={[]}
      />,
    );
    const html = [
      "<!doctype html>",
      '<html lang="en">',
      "<head>",
      '<meta charset="utf-8" />',
      `<title>P0-FE-01 ${scenario.id}</title>`,
      "<style>",
      "body{margin:0;background:#06080d;color:white;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;}",
      "a{color:inherit}button{font:inherit}code{white-space:pre-wrap}",
      "[hidden]{display:none!important}",
      "</style>",
      "</head>",
      "<body>",
      body,
      "</body>",
      "</html>",
    ].join("");

    for (const expected of scenario.expectedText) {
      if (!html.includes(expected)) {
        throw new Error(`${scenario.id} screenshot fixture missing expected text: ${expected}`);
      }
    }
    for (const forbidden of scenario.forbiddenText) {
      if (html.includes(forbidden)) {
        throw new Error(`${scenario.id} screenshot fixture contains forbidden text: ${forbidden}`);
      }
    }

    return html;
  } finally {
    if (previousStrict === undefined) {
      delete process.env.FOUNDEROS_REQUIRE_EXPLICIT_ROLLOUT_ENV;
    } else {
      process.env.FOUNDEROS_REQUIRE_EXPLICIT_ROLLOUT_ENV = previousStrict;
    }
  }
}

mkdirSync(htmlDir, { recursive: true });
mkdirSync(screenshotsDir, { recursive: true });

const manifest = scenarios.map((scenario) => {
  const htmlPath = path.join(htmlDir, `${scenario.id}.html`);
  const screenshotPath = path.join(screenshotsDir, `${scenario.id}.png`);
  writeFileSync(htmlPath, renderScenario(scenario), "utf8");
  return {
    id: scenario.id,
    strictRolloutEnv: scenario.strictRolloutEnv,
    htmlPath,
    screenshotPath,
    expectedText: scenario.expectedText,
    forbiddenText: scenario.forbiddenText,
  };
});

const python = `
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

manifest = json.loads(${JSON.stringify(JSON.stringify(manifest))})

with sync_playwright() as p:
    try:
        browser = p.chromium.launch(channel="chrome", headless=True)
    except Exception:
        browser = p.chromium.launch(headless=True)
    try:
        page = browser.new_page(viewport={"width": 1440, "height": 1200})
        for item in manifest:
            page.goto(Path(item["htmlPath"]).as_uri())
            page.screenshot(path=item["screenshotPath"], full_page=True)
    finally:
        browser.close()
`;

const screenshotResult = spawnSync("python3", ["-"], {
  input: python,
  encoding: "utf8",
});

if (screenshotResult.status !== 0) {
  process.stderr.write(screenshotResult.stdout);
  process.stderr.write(screenshotResult.stderr);
  process.exit(screenshotResult.status ?? 1);
}

const manifestPath = path.join(outputDir, "manifest.json");
writeFileSync(
  manifestPath,
  `${JSON.stringify({ observedAt, outputDir, screenshots: manifest }, null, 2)}\n`,
  "utf8",
);

process.stdout.write(`${manifestPath}\n`);
