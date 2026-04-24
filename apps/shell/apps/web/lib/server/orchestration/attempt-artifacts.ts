import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { WorkUnitRecord } from "../control-plane/contracts/orchestration";

import { resolveInfinityRoot, storeFileArtifact } from "./artifacts";
import { nowIso } from "./shared";

const ATTEMPT_ARTIFACTS_ROOT = path.join(
  resolveInfinityRoot(),
  ".local-state",
  "orchestration",
  "attempt-artifacts"
);
const ATTEMPT_SCAFFOLD_MARKER = "Infinity Attempt Scaffold";

type RunnableAttemptManifest = {
  version: 1;
  artifactRole: "attempt_scaffold_result" | "attempt_real_product_result";
  targetKind: "attempt_scaffold" | "runnable_result";
  targetLabel: string;
  initiativeId: string;
  taskGraphId: string;
  batchId: string | null;
  workUnitId: string;
  attemptId: string;
  workingDirectory: string;
  entryPath: string;
  expectedMarker: string;
  command: string[];
  shellCommand: string;
  generatedAt: string;
};

function shellQuote(value: string) {
  return `'${value.split("'").join(`'"'"'`)}'`;
}

function escapeHtml(value: string | null | undefined) {
  return (value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function attemptArtifactDirectory(initiativeId: string, attemptId: string) {
  return path.join(ATTEMPT_ARTIFACTS_ROOT, initiativeId, attemptId);
}

function runnableLaunchManifestPath(initiativeId: string, attemptId: string) {
  return path.join(
    attemptArtifactDirectory(initiativeId, attemptId),
    "runnable-result",
    "launch-manifest.json"
  );
}

function parseRunnableAttemptManifest(raw: Partial<RunnableAttemptManifest> | null | undefined) {
  if (!raw) {
    return null;
  }

  if (
    (raw.targetKind !== "runnable_result" && raw.targetKind !== "attempt_scaffold") ||
    !(
      (raw.targetKind === "attempt_scaffold" &&
        raw.artifactRole === "attempt_scaffold_result") ||
      (raw.targetKind === "runnable_result" &&
        raw.artifactRole === "attempt_real_product_result")
    ) ||
    typeof raw.targetLabel !== "string" ||
    typeof raw.workingDirectory !== "string" ||
    typeof raw.entryPath !== "string" ||
    typeof raw.expectedMarker !== "string" ||
    !Array.isArray(raw.command) ||
    raw.command.some((part) => typeof part !== "string") ||
    typeof raw.shellCommand !== "string"
  ) {
    return null;
  }

  return raw as RunnableAttemptManifest;
}

function readExistingAttemptManifest(manifestPath: string) {
  if (!existsSync(manifestPath)) {
    return null;
  }

  try {
    const raw = JSON.parse(readFileSync(manifestPath, "utf8")) as Partial<RunnableAttemptManifest>;
    return parseRunnableAttemptManifest(raw);
  } catch {
    return null;
  }
}

function attemptArtifactKey(initiativeId: string, attemptId: string, relativePath: string) {
  return `attempt-artifacts/${initiativeId}/${attemptId}/${relativePath}`;
}

function storedArtifactUri(params: {
  initiativeId: string;
  attemptId: string;
  relativePath: string;
  filePath: string;
  contentType?: string;
}) {
  return storeFileArtifact({
    key: attemptArtifactKey(params.initiativeId, params.attemptId, params.relativePath),
    filePath: params.filePath,
    contentType: params.contentType,
  }).uri;
}

function isRunnableWorkUnit(workUnit: WorkUnitRecord) {
  return (
    workUnit.id.endsWith("final_integration") ||
    workUnit.id.endsWith("workspace_launch")
  );
}

function runnableTargetSpec(workUnit: WorkUnitRecord) {
  if (workUnit.id.endsWith("final_integration")) {
    return {
      artifactRole: "attempt_scaffold_result" as const,
      targetKind: "attempt_scaffold" as const,
      targetLabel: "Final integration scaffold",
      expectedMarker: ATTEMPT_SCAFFOLD_MARKER,
    };
  }
  if (workUnit.id.endsWith("workspace_launch")) {
    return {
      artifactRole: "attempt_scaffold_result" as const,
      targetKind: "attempt_scaffold" as const,
      targetLabel: "Workspace launch scaffold",
      expectedMarker: ATTEMPT_SCAFFOLD_MARKER,
    };
  }
  return {
    artifactRole: "attempt_scaffold_result" as const,
    targetKind: "attempt_scaffold" as const,
    targetLabel: "Attempt scaffold",
    expectedMarker: ATTEMPT_SCAFFOLD_MARKER,
  };
}

function buildLaunchScript(outputDir: string) {
  return [
    "#!/usr/bin/env python3",
    "import argparse",
    "import functools",
    "import http.server",
    "import socketserver",
    `DIRECTORY = ${JSON.stringify(outputDir)}`,
    "",
    "parser = argparse.ArgumentParser()",
    'parser.add_argument("--port", type=int, default=0)',
    'parser.add_argument("--bind", default="127.0.0.1")',
    'parser.add_argument("--entry", default="/index.html")',
    "args = parser.parse_args()",
    "",
    "class ReusableTCPServer(socketserver.TCPServer):",
    "    allow_reuse_address = True",
    "",
    "handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=DIRECTORY)",
    "with ReusableTCPServer((args.bind, args.port), handler) as server:",
    "    host, port = server.server_address[:2]",
    "    print(f\"READY http://{host}:{port}{args.entry}\", flush=True)",
    "    try:",
    "        server.serve_forever()",
    "    except KeyboardInterrupt:",
    "        pass",
    "",
  ].join("\n");
}

function buildAttemptIndexHtml(params: {
  expectedMarker: string;
  targetKind: RunnableAttemptManifest["targetKind"];
  targetLabel: string;
  workUnit: WorkUnitRecord;
}) {
  const modeLabel =
    params.targetKind === "runnable_result" ? "Runnable Result" : "Attempt Scaffold";
  const modeCopy =
    params.targetKind === "runnable_result"
      ? "This page is backed by a real runnable result derived from assembly output."
      : "This page is replayable local evidence only. It does not prove the requested product is runnable yet.";
  const description =
    params.workUnit.description?.trim() || "No additional work-unit description was recorded.";

  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '  <meta charset="utf-8" />',
    `  <title>${escapeHtml(params.targetLabel)}</title>`,
    '  <meta name="viewport" content="width=device-width, initial-scale=1" />',
    "  <style>",
    "    :root { color-scheme: dark; }",
    "    * { box-sizing: border-box; }",
    "    body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0d0f12; color: #edf0f3; }",
    "    main { min-height: 100vh; display: grid; place-items: center; padding: 24px; }",
    "    .card { width: min(760px, 100%); border: 1px solid rgba(255,255,255,0.08); border-radius: 20px; background: rgba(255,255,255,0.03); padding: 28px; box-shadow: inset 0 1px 0 rgba(255,255,255,0.04); }",
    "    .eyebrow { font-size: 11px; text-transform: uppercase; letter-spacing: 0.16em; color: rgba(255,255,255,0.45); }",
    "    h1 { margin: 12px 0 0; font-size: 30px; line-height: 1.08; letter-spacing: -0.05em; }",
    "    p { margin: 12px 0 0; font-size: 14px; line-height: 1.7; color: rgba(255,255,255,0.7); }",
    "    .meta { display: grid; gap: 10px; margin-top: 18px; }",
    "    .row { display: grid; grid-template-columns: 150px 1fr; gap: 12px; padding: 12px 14px; border-radius: 14px; border: 1px solid rgba(255,255,255,0.06); background: rgba(255,255,255,0.02); }",
    "    .k { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; color: rgba(255,255,255,0.52); text-transform: uppercase; letter-spacing: 0.12em; }",
    "    .v { font-size: 13px; color: #fff; word-break: break-word; }",
    "    .marker { position: absolute; opacity: 0; pointer-events: none; }",
    "    @media (max-width: 640px) { .row { grid-template-columns: 1fr; } }",
    "  </style>",
    "</head>",
    "<body>",
    "  <main>",
    '    <section class="card">',
    `      <div class="eyebrow">${escapeHtml(modeLabel)}</div>`,
    `      <h1>${escapeHtml(params.targetLabel)}</h1>`,
    `      <p>${escapeHtml(modeCopy)}</p>`,
    "      <div class=\"meta\">",
    `        <div class="row"><div class="k">Work unit</div><div class="v">${escapeHtml(params.workUnit.title)}</div></div>`,
    `        <div class="row"><div class="k">Description</div><div class="v">${escapeHtml(description)}</div></div>`,
    `        <div class="row"><div class="k">Target kind</div><div class="v">${escapeHtml(params.targetKind)}</div></div>`,
    "      </div>",
    `      <div class="marker">${escapeHtml(params.expectedMarker)}</div>`,
    "    </section>",
    "  </main>",
    "</body>",
    "</html>",
  ].join("\n");
}

export function materializeAttemptArtifacts(params: {
  initiativeId: string;
  taskGraphId: string;
  batchId?: string | null;
  workUnit: WorkUnitRecord;
  attemptId: string;
}) {
  const root = attemptArtifactDirectory(params.initiativeId, params.attemptId);
  mkdirSync(root, { recursive: true });

  const generatedAt = nowIso();
  const summaryPath = path.join(root, "attempt-summary.json");
  writeFileSync(
    summaryPath,
    JSON.stringify(
      {
        initiativeId: params.initiativeId,
        taskGraphId: params.taskGraphId,
        batchId: params.batchId ?? null,
        workUnitId: params.workUnit.id,
        attemptId: params.attemptId,
        title: params.workUnit.title,
        description: params.workUnit.description,
        generatedAt,
      },
      null,
      2
    )
  );

  const artifactUris = [
    storedArtifactUri({
      initiativeId: params.initiativeId,
      attemptId: params.attemptId,
      relativePath: "attempt-summary.json",
      filePath: summaryPath,
      contentType: "application/json",
    }),
  ];
  let summary = "completed";

  if (isRunnableWorkUnit(params.workUnit)) {
    const outputDir = path.join(root, "runnable-result");
    mkdirSync(outputDir, { recursive: true });

    const target = runnableTargetSpec(params.workUnit);
    const label = target.targetLabel;
    const indexPath = path.join(outputDir, "index.html");
    const launchScriptPath = path.join(outputDir, "launch-localhost.py");
    const launchManifestPath = path.join(outputDir, "launch-manifest.json");
    const resultManifestPath = path.join(outputDir, "result-manifest.json");
    const existingManifest = readExistingAttemptManifest(launchManifestPath);
    if (
      existingManifest &&
      existingManifest.artifactRole === target.artifactRole &&
      existingManifest.targetKind === target.targetKind &&
      existingManifest.targetLabel === label &&
      existingManifest.expectedMarker === target.expectedMarker
    ) {
      artifactUris.push(
        storedArtifactUri({
          initiativeId: params.initiativeId,
          attemptId: params.attemptId,
          relativePath: "runnable-result/launch-manifest.json",
          filePath: launchManifestPath,
          contentType: "application/json",
        }),
        storedArtifactUri({
          initiativeId: params.initiativeId,
          attemptId: params.attemptId,
          relativePath: "runnable-result/result-manifest.json",
          filePath: resultManifestPath,
          contentType: "application/json",
        })
      );
      if (existsSync(indexPath)) {
        artifactUris.push(
          storedArtifactUri({
            initiativeId: params.initiativeId,
            attemptId: params.attemptId,
            relativePath: "runnable-result/index.html",
            filePath: indexPath,
            contentType: "text/html; charset=utf-8",
          })
        );
      }
      summary = `${existingManifest.targetLabel} referenced`;
      return {
        summary,
        artifactUris,
      };
    }
    const command = ["python3", launchScriptPath, "--port", "0"];
    const shellCommand = `${command[0]} ${shellQuote(launchScriptPath)} --port 0`;

    writeFileSync(
      indexPath,
      buildAttemptIndexHtml({
        expectedMarker: target.expectedMarker,
        targetKind: target.targetKind,
        targetLabel: label,
        workUnit: params.workUnit,
      })
    );
    writeFileSync(launchScriptPath, buildLaunchScript(outputDir));

    const manifest: RunnableAttemptManifest = {
      version: 1,
      artifactRole: target.artifactRole,
      targetKind: target.targetKind,
      targetLabel: label,
      initiativeId: params.initiativeId,
      taskGraphId: params.taskGraphId,
      batchId: params.batchId ?? null,
      workUnitId: params.workUnit.id,
      attemptId: params.attemptId,
      workingDirectory: outputDir,
      entryPath: "/index.html",
      expectedMarker: target.expectedMarker,
      command,
      shellCommand,
      generatedAt,
    };

    writeFileSync(launchManifestPath, JSON.stringify(manifest, null, 2));
    writeFileSync(
      resultManifestPath,
      JSON.stringify(
        {
          targetKind: target.targetKind,
          targetLabel: label,
          outputDir,
          entryPath: "/index.html",
          generatedAt,
        },
        null,
        2
      )
    );

    artifactUris.push(
      storedArtifactUri({
        initiativeId: params.initiativeId,
        attemptId: params.attemptId,
        relativePath: "runnable-result/launch-manifest.json",
        filePath: launchManifestPath,
        contentType: "application/json",
      }),
      storedArtifactUri({
        initiativeId: params.initiativeId,
        attemptId: params.attemptId,
        relativePath: "runnable-result/result-manifest.json",
        filePath: resultManifestPath,
        contentType: "application/json",
      }),
      storedArtifactUri({
        initiativeId: params.initiativeId,
        attemptId: params.attemptId,
        relativePath: "runnable-result/index.html",
        filePath: indexPath,
        contentType: "text/html; charset=utf-8",
      })
    );
    summary = `${label} materialized`;
  }

  return {
    summary,
    artifactUris,
  };
}

export function readRunnableAttemptTarget(params: {
  initiativeId: string;
  attemptId: string;
}) {
  const manifestPath = runnableLaunchManifestPath(params.initiativeId, params.attemptId);
  if (!existsSync(manifestPath)) {
    return null;
  }

  const raw = JSON.parse(readFileSync(manifestPath, "utf8")) as Partial<RunnableAttemptManifest>;
  const manifest = parseRunnableAttemptManifest(raw);
  if (!manifest) {
    return null;
  }

  return {
    launchManifestPath: manifestPath,
    launchProofKind: manifest.targetKind,
    launchTargetLabel: manifest.targetLabel,
    workingDirectory: manifest.workingDirectory,
    entryPath: manifest.entryPath,
    expectedMarker: manifest.expectedMarker,
    command: manifest.command,
    shellCommand: manifest.shellCommand,
  };
}
