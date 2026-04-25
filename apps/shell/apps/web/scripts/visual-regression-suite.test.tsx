import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { AutonomousRecordBoard } from "../components/execution/autonomous-record-board";
import { DeliverySummary } from "../components/orchestration/delivery-summary";
import type { DeliveryRecord } from "../lib/server/control-plane/contracts/orchestration";

type BaselineEntry = {
  width: number;
  height: number;
  sha256: string;
  imagePath: string;
};

type BaselineFile = {
  version: 1;
  surfaces: Record<string, BaselineEntry>;
};

type VisualSurface = {
  id: string;
  html: string;
  expectedText: string[];
};

const fixedNow = "2026-04-25T01:00:00.000Z";
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const baselinePath = path.join(scriptDir, "visual-regression-baselines.json");
const baselineImageDir = path.join(scriptDir, "visual-baselines");
const outputDir = path.resolve(
  scriptDir,
  "../../../../../.local-state/p1-qa-01-visual-regression",
  fixedNow.replace(/[:.]/g, "-"),
);
const htmlDir = path.join(outputDir, "html");
const screenshotsDir = path.join(outputDir, "screenshots");
const updateBaselines = process.env.FOUNDEROS_UPDATE_VISUAL_BASELINES === "1";

const verification = {
  id: "verification-visual-regression",
  initiativeId: "initiative-visual-regression",
  assemblyId: "assembly-visual-regression",
  overallStatus: "passed" as const,
  checks: [{ name: "targeted_tests_passed", status: "passed" }],
  startedAt: fixedNow,
  finishedAt: fixedNow,
};

const assembly = {
  id: "assembly-visual-regression",
  initiativeId: "initiative-visual-regression",
  taskGraphId: "task-graph-visual-regression",
  inputWorkUnitIds: ["work-unit-visual-regression"],
  artifactUris: ["r2://infinity-artifacts/visual-regression/work-unit.json"],
  outputLocation: "r2://infinity-artifacts/visual-regression",
  manifestPath: "r2://infinity-artifacts/visual-regression/manifest.json",
  summary: "Visual regression assembly.",
  status: "assembled" as const,
  createdAt: fixedNow,
  updatedAt: fixedNow,
};

function withStrictRolloutEnv<T>(enabled: boolean, callback: () => T) {
  const previous = process.env.FOUNDEROS_REQUIRE_EXPLICIT_ROLLOUT_ENV;
  if (enabled) {
    process.env.FOUNDEROS_REQUIRE_EXPLICIT_ROLLOUT_ENV = "1";
  } else {
    delete process.env.FOUNDEROS_REQUIRE_EXPLICIT_ROLLOUT_ENV;
  }

  try {
    return callback();
  } finally {
    if (previous === undefined) {
      delete process.env.FOUNDEROS_REQUIRE_EXPLICIT_ROLLOUT_ENV;
    } else {
      process.env.FOUNDEROS_REQUIRE_EXPLICIT_ROLLOUT_ENV = previous;
    }
  }
}

function previewScreenshotDataUri() {
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 540">',
    '<rect width="960" height="540" fill="#f7fafc"/>',
    '<rect x="72" y="64" width="816" height="84" rx="12" fill="#0f172a"/>',
    '<rect x="96" y="190" width="360" height="180" rx="16" fill="#bae6fd"/>',
    '<rect x="504" y="190" width="360" height="180" rx="16" fill="#bbf7d0"/>',
    '<text x="96" y="118" font-family="Arial" font-size="34" fill="#ffffff">Production preview</text>',
    '<text x="96" y="430" font-family="Arial" font-size="26" fill="#334155">Verified handoff surface</text>',
    "</svg>",
  ].join("");
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function productionDelivery(): DeliveryRecord {
  return {
    id: "delivery-visual-production",
    initiativeId: "initiative-visual-production",
    verificationRunId: verification.id,
    taskGraphId: "task-graph-visual-regression",
    resultSummary: "Production proof is attached.",
    localOutputPath: null,
    manifestPath: "r2://infinity-artifacts/prod/deliveries/delivery-visual-production/delivery-manifest.json",
    previewUrl: "http://127.0.0.1:3737/api/control/orchestration/previews/visual-production",
    launchManifestPath: "r2://infinity-artifacts/prod/deliveries/delivery-visual-production/launch/launch-manifest.json",
    launchProofKind: "runnable_result",
    launchTargetLabel: "Visual production preview",
    launchProofUrl: "https://delivery-visual-production.preview.infinity.example/index.html",
    launchProofAt: fixedNow,
    externalPullRequestUrl: "https://github.com/founderos/infinity/pull/900",
    externalPreviewUrl: "https://delivery-visual-production.preview.infinity.example",
    externalPreviewProvider: "vercel",
    externalPreviewDeploymentId: "vercel-preview-visual-production",
    externalDeliveryProof: {
      preview: {
        screenshotUrl: previewScreenshotDataUri(),
      },
    },
    externalProofManifestPath: "r2://infinity-artifacts/prod/deliveries/delivery-visual-production/external-delivery-proof.json",
    ciProofUri: "https://github.com/founderos/infinity/commit/visual/checks",
    ciProofProvider: "github_commit_status",
    ciProofId: "github-status-visual-production",
    artifactStorageUri: "r2://infinity-artifacts/prod/deliveries/delivery-visual-production",
    signedManifestUri: "https://artifacts.infinity.example/download?key=visual&signature=proof",
    readinessTier: "production",
    command: null,
    status: "ready",
    deliveredAt: fixedNow,
  };
}

function renderDeliverySurface({
  id,
  delivery,
  strict,
  previewTarget,
}: {
  id: string;
  delivery: DeliveryRecord;
  strict: boolean;
  previewTarget?: React.ComponentProps<typeof DeliverySummary>["previewTarget"];
}) {
  return {
    id,
    html: withStrictRolloutEnv(strict, () =>
      renderToStaticMarkup(
        <DeliverySummary
          delivery={delivery}
          initiativeTitle={`Visual ${id}`}
          initiativePrompt={`Render ${id} for visual regression.`}
          verification={verification}
          assembly={assembly}
          taskGraphId="task-graph-visual-regression"
          runId="run-visual-regression"
          handoffId={`handoff-${id}`}
          sourceWorkUnits={[]}
          previewTarget={previewTarget ?? null}
        />,
      ),
    ),
    expectedText: ["Visual", "Delivery", "Validation"],
  };
}

function buildSurfaces(): VisualSurface[] {
  const expiredDelivery: DeliveryRecord = {
    ...productionDelivery(),
    id: "delivery-visual-expired",
    initiativeId: "initiative-visual-expired",
    externalPreviewUrl: null,
    externalDeliveryProof: null,
    readinessTier: "staging",
    status: "pending",
  };

  return [
    renderDeliverySurface({
      id: "delivery-production-ready",
      delivery: productionDelivery(),
      strict: true,
    }),
    {
      ...renderDeliverySurface({
        id: "delivery-preview-expired",
        delivery: expiredDelivery,
        strict: true,
        previewTarget: {
          id: "preview-visual-expired",
          runId: "run-visual-regression",
          deliveryId: "delivery-visual-expired",
          mode: "local",
          url: "http://127.0.0.1:3737/api/control/orchestration/previews/visual-expired",
          healthStatus: "failed",
          sourcePath: "/tmp/infinity-delivery/visual-expired/preview.html",
          createdAt: fixedNow,
          updatedAt: fixedNow,
        },
      }),
      expectedText: ["Preview expired", "Rebuild preview", "Open task graph"],
    },
    {
      id: "execution-record-board",
      html: renderToStaticMarkup(
        <AutonomousRecordBoard
          eyebrow="Execution"
          title="Visual board"
          description="Visual baseline for execution board scan density."
          items={[
            {
              id: "run-visual-active",
              headline: "Active production run",
              detail: "Building an object-store backed delivery.",
              stage: "running",
              preview: "building",
              handoff: "none",
              tasks: "2 / 5",
              agent: "codex",
              href: "/execution/runs/run-visual-active",
              group: "running",
            },
            {
              id: "run-visual-blocked",
              headline: "Blocked preview recovery",
              detail: "Preview target expired and needs rebuild.",
              stage: "blocked",
              preview: "expired",
              handoff: "building",
              tasks: "4 / 5",
              agent: "codex",
              href: null,
              group: "attention",
            },
          ]}
          emptyTitle="No runs"
          emptyDescription="No visual rows"
        />,
      ),
      expectedText: ["Visual board", "Active production run", "Blocked preview recovery"],
    },
  ];
}

function wrapHtml(surface: VisualSurface) {
  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8" />',
    `<title>${surface.id}</title>`,
    "<style>",
    visualBaselineCss(),
    "</style>",
    "</head>",
    "<body>",
    surface.html,
    "</body>",
    "</html>",
  ].join("");
}

function readCssFixture(relativePath: string) {
  const css = readFileSync(path.resolve(scriptDir, relativePath), "utf8");
  return css
    .replace(/^@import .+$/gm, "")
    .replace(/@custom-variant[^{;]+;/g, "")
    .replace(/@theme[^{]+\{[\s\S]*?\n\}/g, "")
    .replace(/@layer[^{]+\{[\s\S]*?\n\}/g, "");
}

function visualBaselineCss() {
  return [
    readCssFixture("../../../../../packages/ui/src/styles/globals.css"),
    readCssFixture("../app/globals.css"),
    `
      body{margin:0;background:#06080d;color:white;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;}
      a{color:inherit;text-decoration:none}button{font:inherit}code{white-space:pre-wrap}iframe{border:0}img{display:block}[hidden]{display:none!important}
      main{padding:32px}
      .mx-auto{margin-left:auto;margin-right:auto}.max-w-\\[1520px\\]{max-width:1520px}.max-w-\\[1280px\\]{max-width:1280px}
      .grid{display:grid}.flex{display:flex}.inline-flex{display:inline-flex}.hidden{display:none}.block{display:block}
      .items-center{align-items:center}.items-start{align-items:flex-start}.items-end{align-items:flex-end}.justify-between{justify-content:space-between}.justify-center{justify-content:center}.place-items-center{place-items:center}
      .flex-wrap{flex-wrap:wrap}.flex-col{flex-direction:column}.flex-1{flex:1 1 0%}.min-w-0{min-width:0}.overflow-hidden{overflow:hidden}.overflow-auto{overflow:auto}.truncate{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .gap-2{gap:8px}.gap-3{gap:12px}.gap-4{gap:16px}.gap-5{gap:20px}.space-y-1>*+*{margin-top:4px}.space-y-2>*+*{margin-top:8px}.space-y-3>*+*{margin-top:12px}.space-y-4>*+*{margin-top:16px}.space-y-5>*+*{margin-top:20px}
      .mt-1{margin-top:4px}.mt-2{margin-top:8px}.mt-3{margin-top:12px}.mt-4{margin-top:16px}.mt-5{margin-top:20px}.px-3{padding-left:12px;padding-right:12px}.px-4{padding-left:16px;padding-right:16px}.px-5{padding-left:20px;padding-right:20px}.px-6{padding-left:24px;padding-right:24px}.py-1{padding-top:4px;padding-bottom:4px}.py-2{padding-top:8px;padding-bottom:8px}.py-3{padding-top:12px;padding-bottom:12px}.py-4{padding-top:16px;padding-bottom:16px}.py-5{padding-top:20px;padding-bottom:20px}.py-8{padding-top:32px;padding-bottom:32px}.p-\\[2px\\]{padding:2px}
      [class*="rounded"]{border-radius:14px}.rounded-full{border-radius:999px}[class*="border"]{border:1px solid rgba(255,255,255,.09)}.border-b{border-bottom:1px solid rgba(255,255,255,.08)}.border-t{border-top:1px solid rgba(255,255,255,.08)}.border-l{border-left:1px solid rgba(255,255,255,.08)}
      [class*="bg-white"]{background:rgba(255,255,255,.035)}[class*="bg-black"]{background:rgba(0,0,0,.25)}[class*="bg-emerald"]{background:rgba(73,209,141,.14)}[class*="bg-amber"]{background:rgba(245,158,11,.14)}[class*="bg-sky"]{background:rgba(56,189,248,.14)}[class*="bg-rose"]{background:rgba(244,63,94,.16)}
      [class*="text-white"]{color:rgba(255,255,255,.86)}[class*="text-emerald"]{color:#bef0d6}[class*="text-amber"]{color:#fde3b5}[class*="text-sky"]{color:#cfe8fb}[class*="text-rose"]{color:#fbcbd4}[class*="text-\\[var\\(--shell-sidebar-muted\\)\\]"]{color:var(--shell-sidebar-muted)}
      .font-mono{font-family:"SFMono-Regular",Menlo,Consolas,monospace}.font-semibold{font-weight:650}.font-medium{font-weight:560}.uppercase{text-transform:uppercase}.tracking-\\[0\\.14em\\],.tracking-\\[0\\.16em\\],.tracking-\\[0\\.18em\\]{letter-spacing:.14em}.text-center{text-align:center}.text-right{text-align:right}
      [class*="text-\\[10px\\]"]{font-size:10px}[class*="text-\\[11px\\]"]{font-size:11px}[class*="text-\\[12px\\]"]{font-size:12px}[class*="text-\\[13px\\]"]{font-size:13px}[class*="text-\\[14px\\]"]{font-size:14px}[class*="text-\\[15px\\]"]{font-size:15px}[class*="text-\\[16px\\]"]{font-size:16px}[class*="text-\\[18px\\]"]{font-size:18px}[class*="text-\\[20px\\]"]{font-size:20px}[class*="text-\\[22px\\]"]{font-size:22px}[class*="text-\\[26px\\]"]{font-size:26px}
      [class*="leading-5"]{line-height:20px}[class*="leading-6"]{line-height:24px}[class*="leading-7"]{line-height:28px}[class*="leading-8"]{line-height:32px}
      .h-2{height:8px}.w-2{width:8px}.h-1\\.5{height:6px}.w-1\\.5{width:6px}.w-full{width:100%}.h-\\[420px\\]{height:420px}.min-h-\\[420px\\]{min-height:420px}.object-cover{object-fit:cover}
      main.grid{grid-template-columns:minmax(0,1fr) 400px;gap:20px}section .md\\:grid-cols-5{grid-template-columns:repeat(5,minmax(0,1fr))}.lg\\:grid-cols-2{grid-template-columns:repeat(2,minmax(0,1fr))}
      main section{min-width:0}.sticky{position:sticky;top:0}.xl\\:block{display:block}
      button{border:1px solid rgba(255,255,255,.12);border-radius:999px;background:rgba(255,255,255,.06);color:white;padding:8px 12px}
      [data-preview-card-state]{background:#0d0f12}[data-preview-screenshot]{width:100%;height:420px;object-fit:cover}
    `,
  ].join("\n");
}

function screenshotSurfaces(surfaces: VisualSurface[]) {
  mkdirSync(htmlDir, { recursive: true });
  mkdirSync(screenshotsDir, { recursive: true });

  const manifest = surfaces.map((surface) => {
    const html = wrapHtml(surface);
    for (const expected of surface.expectedText) {
      if (!html.includes(expected)) {
        throw new Error(`${surface.id} missing expected text: ${expected}`);
      }
    }
    const htmlPath = path.join(htmlDir, `${surface.id}.html`);
    const screenshotPath = path.join(screenshotsDir, `${surface.id}.png`);
    writeFileSync(htmlPath, html, "utf8");
    return { id: surface.id, htmlPath, screenshotPath };
  });

  const python = `
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

manifest = json.loads(${JSON.stringify(JSON.stringify(manifest))})

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    try:
        page = browser.new_page(viewport={"width": 1440, "height": 1200})
        for item in manifest:
            page.goto(Path(item["htmlPath"]).as_uri())
            page.wait_for_load_state("networkidle")
            page.screenshot(path=item["screenshotPath"], full_page=False)
    finally:
        browser.close()
`;

  const result = spawnSync("python3", ["-"], {
    input: python,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(`${result.stdout}${result.stderr}`);
  }
  return manifest;
}

function readBaseline() {
  if (!existsSync(baselinePath)) {
    return { version: 1, surfaces: {} } satisfies BaselineFile;
  }
  return JSON.parse(readFileSync(baselinePath, "utf8")) as BaselineFile;
}

function hashFile(filePath: string) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function approvedBaselineEntries(baseline: BaselineFile) {
  return Object.fromEntries(
    Object.entries(baseline.surfaces).map(([id, entry]) => {
      const imagePath = path.join(scriptDir, entry.imagePath);
      if (!existsSync(imagePath)) {
        throw new Error(`${id} approved baseline image is missing: ${entry.imagePath}`);
      }
      const imageSha256 = hashFile(imagePath);
      if (imageSha256 !== entry.sha256) {
        throw new Error(`${id} baseline JSON sha256 does not match ${entry.imagePath}`);
      }
      return [
        id,
        {
          width: entry.width,
          height: entry.height,
          sha256: imageSha256,
        },
      ];
    }),
  );
}

function assertBaselineUpdateAllowed({
  updateRequested,
  ci,
  allowCiUpdate,
}: {
  updateRequested: boolean;
  ci: string | undefined;
  allowCiUpdate: string | undefined;
}) {
  if (updateRequested && ci && allowCiUpdate !== "1") {
    throw new Error(
      "FOUNDEROS_UPDATE_VISUAL_BASELINES cannot run in CI without FOUNDEROS_ALLOW_CI_VISUAL_BASELINE_UPDATE=1.",
    );
  }
}

describe("visual regression baselines", () => {
  test("rejects baseline updates in CI without explicit override", () => {
    expect(() =>
      assertBaselineUpdateAllowed({
        updateRequested: true,
        ci: "true",
        allowCiUpdate: undefined,
      }),
    ).toThrow("FOUNDEROS_ALLOW_CI_VISUAL_BASELINE_UPDATE=1");

    expect(() =>
      assertBaselineUpdateAllowed({
        updateRequested: true,
        ci: "true",
        allowCiUpdate: "1",
      }),
    ).not.toThrow();
  });

  test("key shell surfaces match approved screenshot baselines", () => {
    assertBaselineUpdateAllowed({
      updateRequested: updateBaselines,
      ci: process.env.CI,
      allowCiUpdate: process.env.FOUNDEROS_ALLOW_CI_VISUAL_BASELINE_UPDATE,
    });
    const screenshots = screenshotSurfaces(buildSurfaces());
    const observed = Object.fromEntries(
      screenshots.map((item) => {
        const imagePath = `visual-baselines/${item.id}.png`;
        return [
          item.id,
          {
            width: 1440,
            height: 1200,
            sha256: hashFile(item.screenshotPath),
            imagePath,
          },
        ];
      }),
    ) as Record<string, BaselineEntry>;
    const comparableObserved = Object.fromEntries(
      Object.entries(observed).map(([id, entry]) => [
        id,
        {
          width: entry.width,
          height: entry.height,
          sha256: entry.sha256,
        },
      ]),
    );

    if (updateBaselines) {
      mkdirSync(baselineImageDir, { recursive: true });
      for (const item of screenshots) {
        copyFileSync(item.screenshotPath, path.join(baselineImageDir, `${item.id}.png`));
      }
      writeFileSync(
        baselinePath,
        `${JSON.stringify({ version: 1, surfaces: observed } satisfies BaselineFile, null, 2)}\n`,
        "utf8",
      );
      return;
    }

    expect(comparableObserved).toEqual(approvedBaselineEntries(readBaseline()));
  });
});
