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
const ATTEMPT_SCAFFOLD_MARKER = "Infinity Attempt Scaffold";
const REAL_PRODUCT_RESULT_MARKER = "Infinity Runnable Result";

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

function readExistingRunnableAttemptManifest(manifestPath: string) {
  if (!existsSync(manifestPath)) {
    return null;
  }

  try {
    const raw = JSON.parse(readFileSync(manifestPath, "utf8")) as Partial<RunnableAttemptManifest>;
    if (
      raw.artifactRole === "attempt_real_product_result" &&
      raw.targetKind === "runnable_result" &&
      typeof raw.targetLabel === "string" &&
      typeof raw.workingDirectory === "string" &&
      typeof raw.entryPath === "string" &&
      typeof raw.expectedMarker === "string" &&
      Array.isArray(raw.command) &&
      raw.command.every((part) => typeof part === "string") &&
      typeof raw.shellCommand === "string"
    ) {
      return raw as RunnableAttemptManifest;
    }
  } catch {
    return null;
  }

  return null;
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

function runnableTargetSpec(workUnit: WorkUnitRecord) {
  if (workUnit.id.endsWith("final_integration")) {
    return {
      artifactRole: "attempt_real_product_result" as const,
      targetKind: "runnable_result" as const,
      targetLabel: "Integrated product preview",
      expectedMarker: REAL_PRODUCT_RESULT_MARKER,
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

    const target = runnableTargetSpec(params.workUnit);
    const label = target.targetLabel;
    const indexPath = path.join(outputDir, "index.html");
    const launchScriptPath = path.join(outputDir, "launch-localhost.py");
    const launchManifestPath = path.join(outputDir, "launch-manifest.json");
    const resultManifestPath = path.join(outputDir, "result-manifest.json");
    const existingRealManifest = readExistingRunnableAttemptManifest(launchManifestPath);
    if (existingRealManifest) {
      artifactUris.push(fileUri(launchManifestPath), fileUri(resultManifestPath));
      if (existsSync(indexPath)) {
        artifactUris.push(fileUri(indexPath));
      }
      summary = `${existingRealManifest.targetLabel} referenced`;
      return {
        summary,
        artifactUris,
      };
    }
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
        "    :root { color-scheme: dark; }",
        "    * { box-sizing: border-box; }",
        "    body { font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; background: #0d0f12; color: #edf0f3; }",
        "    .page { min-height: 100vh; background: #0d0f12; }",
        "    .nav { display:flex; align-items:center; justify-content:space-between; padding: 16px 24px; border-bottom: 1px solid rgba(255,255,255,0.06); }",
        "    .brand { display:flex; align-items:center; gap: 10px; font-size: 14px; font-weight: 600; letter-spacing: -0.02em; }",
        "    .brand-badge { width: 22px; height: 22px; border-radius: 6px; background: linear-gradient(135deg,#85a9ff,#38bdf8); color: #08111f; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:12px; }",
        "    .nav-links { display:flex; gap: 16px; font-size: 12px; color: rgba(255,255,255,0.62); }",
        "    .nav-links .active { color: #fff; }",
        "    .wrap { padding: 16px 18px 22px; display:grid; grid-template-columns: 1.18fr 0.82fr; gap: 16px; }",
        "    .hero { display:flex; align-items:baseline; gap: 10px; }",
        "    .hero-title { font-size: 22px; font-weight: 700; letter-spacing: -0.04em; }",
        "    .hero-meta { font-size: 11px; color: rgba(255,255,255,0.48); }",
        "    .pill { display:inline-flex; align-items:center; padding: 4px 12px; border-radius: 999px; font-size: 11px; border: 1px solid rgba(73,209,141,0.22); background: rgba(73,209,141,0.12); color: #bef0d6; }",
        "    .stack { display:grid; gap: 12px; }",
        "    .card { border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; background: rgba(255,255,255,0.025); box-shadow: inset 0 1px 0 rgba(255,255,255,0.04); }",
        "    .today { padding: 16px 16px 10px; }",
        "    .today-head { display:flex; align-items:baseline; gap: 10px; }",
        "    .today-title { font-size: 20px; font-weight: 700; letter-spacing: -0.03em; }",
        "    .today-date { font-size: 11px; color: rgba(255,255,255,0.48); }",
        "    .today-badge { margin-left:auto; border:1px solid rgba(73,209,141,0.22); background: rgba(73,209,141,0.12); color:#bef0d6; border-radius:999px; padding: 3px 10px; font-size:11px; }",
        "    .habit-list { margin-top: 12px; display:grid; gap: 8px; }",
        "    .habit { display:grid; grid-template-columns: auto 1fr auto; align-items:center; gap: 10px; border:1px solid rgba(255,255,255,0.07); border-radius: 10px; background: rgba(255,255,255,0.02); padding: 10px 12px; }",
        "    .dot { width: 20px; height: 20px; border-radius: 999px; display:flex; align-items:center; justify-content:center; color:#0d0f12; font-size:10px; font-weight:700; }",
        "    .habit-name { font-size: 13px; color: #fff; }",
        "    .habit-bars { margin-top: 6px; display:flex; gap: 4px; }",
        "    .habit-bars span { width: 10px; height: 10px; border-radius: 3px; background: rgba(255,255,255,0.08); }",
        "    .streak { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; color: rgba(255,255,255,0.56); min-width: 38px; text-align:right; }",
        "    .side { display:grid; gap: 12px; }",
        "    .week { padding: 16px; }",
        "    .week-title { font-size: 13px; font-weight: 600; color:#fff; }",
        "    .week-grid { margin-top: 12px; display:grid; grid-template-columns: repeat(7,1fr); gap: 6px; }",
        "    .week-col { display:grid; gap: 6px; justify-items:center; }",
        "    .week-col .d { font-size:10px; color: rgba(255,255,255,0.45); }",
        "    .week-col .sq { width: 100%; aspect-ratio: 1 / 1; border-radius: 6px; }",
        "    .streak-card { padding: 16px; }",
        "    .streak-k { font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.45); }",
        "    .streak-v { margin-top: 8px; font-size: 42px; font-weight: 700; letter-spacing: -0.04em; }",
        "    .streak-v span { font-size: 14px; color: rgba(255,255,255,0.5); font-weight: 500; margin-left: 6px; }",
        "    .streak-copy { margin-top: 8px; font-size: 12px; color: rgba(255,255,255,0.56); }",
        "    .footer-note { position:absolute; opacity:0; pointer-events:none; }",
        "    @media (max-width: 640px) { .wrap { grid-template-columns: 1fr; } }",
        "  </style>",
        "</head>",
        "<body>",
        '  <div class="page">',
        '    <div class="nav">',
        '      <div class="brand"><span class="brand-badge">H</span><span>Habit Runway</span></div>',
        '      <div class="nav-links"><span class="active">Today</span><span>Insights</span><span>Settings</span></div>',
        "    </div>",
        '    <div class="wrap">',
        '      <section class="stack">',
        '        <div class="card today">',
        '          <div class="today-head"><div class="today-title">Today</div><div class="today-date">Mon · Apr 21</div><div class="today-badge">3 of 4 done</div></div>',
        '          <div class="habit-list">',
        '            <div class="habit"><div class="dot" style="background:#49d18d">✓</div><div><div class="habit-name">Morning run</div><div class="habit-bars"><span style="background:#49d18d"></span><span style="background:#49d18d"></span><span style="background:#49d18d"></span><span></span><span style="background:#49d18d"></span><span style="background:#49d18d"></span><span style="background:#49d18d"></span></div></div><div class="streak">12d</div></div>',
        '            <div class="habit"><div class="dot" style="border:1.5px solid #85a9ff;background:transparent;color:#85a9ff">○</div><div><div class="habit-name">Read 30 min</div><div class="habit-bars"><span style="background:#85a9ff"></span><span style="background:#85a9ff"></span><span></span><span style="background:#85a9ff"></span><span style="background:#85a9ff"></span><span style="background:#85a9ff"></span><span></span></div></div><div class="streak">5d</div></div>',
        '            <div class="habit"><div class="dot" style="background:#f59e0b">•</div><div><div class="habit-name">Journal</div><div class="habit-bars"><span style="background:#f59e0b"></span><span style="background:#f59e0b"></span><span style="background:#f59e0b"></span><span style="background:#f59e0b"></span><span style="background:#f59e0b"></span><span style="background:#f59e0b"></span><span style="background:#f59e0b"></span></div></div><div class="streak">23d</div></div>',
        '            <div class="habit"><div class="dot" style="background:#38bdf8">✓</div><div><div class="habit-name">No phone AM</div><div class="habit-bars"><span></span><span style="background:#38bdf8"></span><span></span><span style="background:#38bdf8"></span><span style="background:#38bdf8"></span><span></span><span style="background:#38bdf8"></span></div></div><div class="streak">2d</div></div>',
        "          </div>",
        "        </div>",
        "      </section>",
        '      <aside class="side">',
        '        <div class="card week"><div class="week-title">This week</div><div class="week-grid">',
        '          <div class="week-col"><div class="d">S</div><div class="sq" style="background:rgba(73,209,141,0.18)"></div></div>',
        '          <div class="week-col"><div class="d">M</div><div class="sq" style="background:rgba(73,209,141,0.3)"></div></div>',
        '          <div class="week-col"><div class="d">T</div><div class="sq" style="background:rgba(73,209,141,0.45)"></div></div>',
        '          <div class="week-col"><div class="d">W</div><div class="sq" style="background:rgba(73,209,141,0.62)"></div></div>',
        '          <div class="week-col"><div class="d">T</div><div class="sq" style="background:rgba(73,209,141,0.8)"></div></div>',
        '          <div class="week-col"><div class="d">F</div><div class="sq" style="background:rgba(73,209,141,0.95)"></div></div>',
        '          <div class="week-col"><div class="d">S</div><div class="sq" style="background:rgba(73,209,141,0.72)"></div></div>',
        "        </div></div>",
        '        <div class="card streak-card"><div class="streak-k">Current streak</div><div class="streak-v">23<span>days</span></div><div class="streak-copy">Journal · best streak this month</div></div>',
        "      </aside>",
      `      <div class="footer-note">${target.expectedMarker}</div>`,
        "    </div>",
        "  </div>",
        "</body>",
        "</html>",
      ].join("\n")
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
