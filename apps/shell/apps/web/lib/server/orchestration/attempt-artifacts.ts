import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { WorkUnitRecord } from "../control-plane/contracts/orchestration";

import { resolveInfinityRoot } from "./artifacts";
import { nowIso } from "./shared";

const ATTEMPT_ARTIFACTS_ROOT = path.join(
  resolveInfinityRoot(),
  ".local-state",
  "orchestration",
  "attempt-artifacts"
);
const RUNNABLE_RESULT_MARKER = "Infinity Runnable Result";

type RunnableAttemptManifest = {
  version: 1;
  artifactRole: "attempt_runnable_result";
  targetKind: "runnable_result";
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

function fileUri(filePath: string) {
  return `file://${filePath}`;
}

function isRunnableWorkUnit(workUnit: WorkUnitRecord) {
  return (
    workUnit.id.endsWith("final_integration") ||
    workUnit.id.endsWith("workspace_launch")
  );
}

function runnableTargetLabel(workUnit: WorkUnitRecord) {
  if (workUnit.id.endsWith("final_integration")) {
    return "Final integration app";
  }
  if (workUnit.id.endsWith("workspace_launch")) {
    return "Workspace launch app";
  }
  return "Runnable result";
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

  const artifactUris = [fileUri(summaryPath)];
  let summary = "completed";

  if (isRunnableWorkUnit(params.workUnit)) {
    const outputDir = path.join(root, "runnable-result");
    mkdirSync(outputDir, { recursive: true });

    const label = runnableTargetLabel(params.workUnit);
    const indexPath = path.join(outputDir, "index.html");
    const launchScriptPath = path.join(outputDir, "launch-localhost.py");
    const launchManifestPath = path.join(outputDir, "launch-manifest.json");
    const resultManifestPath = path.join(outputDir, "result-manifest.json");
    const command = ["python3", launchScriptPath, "--port", "0"];
    const shellCommand = `${command[0]} ${shellQuote(launchScriptPath)} --port 0`;

    writeFileSync(
      indexPath,
      [
        "<!doctype html>",
        '<html lang="en">',
        "<head>",
        '  <meta charset="utf-8" />',
        `  <title>${label}</title>`,
        '  <meta name="viewport" content="width=device-width, initial-scale=1" />',
        "  <style>",
        "    body { font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; background: #07111f; color: #f8fafc; }",
        "    main { max-width: 880px; margin: 48px auto; padding: 40px; background: rgba(15,23,42,0.88); border: 1px solid rgba(148,163,184,0.2); border-radius: 28px; box-shadow: 0 20px 60px rgba(2,6,23,0.35); }",
        "    h1 { margin: 0 0 12px; font-size: 32px; }",
        "    p, li { font-size: 15px; line-height: 1.7; }",
        "    code { background: rgba(148,163,184,0.14); border-radius: 999px; padding: 2px 8px; }",
        "  </style>",
        "</head>",
        "<body>",
        "  <main>",
        `    <div style="text-transform: uppercase; letter-spacing: 0.16em; font-size: 11px; color: #93c5fd;">${RUNNABLE_RESULT_MARKER}</div>`,
        `    <h1>${label}</h1>`,
        `    <p>This runnable result was produced from attempt <code>${params.attemptId}</code> for work unit <code>${params.workUnit.id}</code>.</p>`,
        "    <ul>",
        `      <li>Initiative: <code>${params.initiativeId}</code></li>`,
        `      <li>Task graph: <code>${params.taskGraphId}</code></li>`,
        `      <li>Work unit: <code>${params.workUnit.title}</code></li>`,
        "    </ul>",
        "  </main>",
        "</body>",
        "</html>",
      ].join("\n")
    );
    writeFileSync(launchScriptPath, buildLaunchScript(outputDir));

    const manifest: RunnableAttemptManifest = {
      version: 1,
      artifactRole: "attempt_runnable_result",
      targetKind: "runnable_result",
      targetLabel: label,
      initiativeId: params.initiativeId,
      taskGraphId: params.taskGraphId,
      batchId: params.batchId ?? null,
      workUnitId: params.workUnit.id,
      attemptId: params.attemptId,
      workingDirectory: outputDir,
      entryPath: "/index.html",
      expectedMarker: RUNNABLE_RESULT_MARKER,
      command,
      shellCommand,
      generatedAt,
    };

    writeFileSync(launchManifestPath, JSON.stringify(manifest, null, 2));
    writeFileSync(
      resultManifestPath,
      JSON.stringify(
        {
          targetKind: "runnable_result",
          targetLabel: label,
          outputDir,
          entryPath: "/index.html",
          generatedAt,
        },
        null,
        2
      )
    );

    artifactUris.push(fileUri(launchManifestPath), fileUri(resultManifestPath), fileUri(indexPath));
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
  if (
    raw.targetKind !== "runnable_result" ||
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

  return {
    launchManifestPath: manifestPath,
    launchProofKind: raw.targetKind,
    launchTargetLabel: raw.targetLabel,
    workingDirectory: raw.workingDirectory,
    entryPath: raw.entryPath,
    expectedMarker: raw.expectedMarker,
    command: raw.command,
    shellCommand: raw.shellCommand,
  };
}
