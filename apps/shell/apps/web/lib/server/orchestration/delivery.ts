import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  DeliveryRecord,
  DeliveryLaunchProofKind,
  AssemblyRecord,
  DeliveryMutationResponse,
  WorkUnitRecord,
} from "../control-plane/contracts/orchestration";
import { readControlPlaneState, updateControlPlaneState } from "../control-plane/state/store";

import {
  appendAutonomousRunEvent,
  buildAutonomousValidationProof,
  findAutonomousRunByInitiativeId,
  materializeDeliveryEvidence,
  syncAutonomousRunTimeline,
  updateAutonomousRunStage,
  upsertHandoffPacketRecord,
  upsertPreviewTargetRecord,
  upsertValidationProofRecord,
} from "./autonomous-run";
import { materializeAttemptArtifacts, readRunnableAttemptTarget } from "./attempt-artifacts";
import { listAssemblies } from "./assembly";
import { resolveOrchestrationDeliveriesRoot, writeDeliveryManifest } from "./artifacts";
import { listVerifications } from "./verification";
import { listOrchestrationWorkUnits } from "./work-units";
import { buildOrchestrationDirectoryMeta, buildOrchestrationId, nowIso } from "./shared";

const LOCALHOST_PROOF_MARKER = "Infinity Local Preview";
const DELIVERY_RESULT_MARKER = "Infinity Delivery Result";
const DELIVERY_LAUNCH_TIMEOUT_MS = 8_000;
const DELIVERY_READY_URL_PATTERN = /READY\s+(http:\/\/127\.0\.0\.1:\d+\S+)/;
const DELIVERY_PYTHON_BIN = process.env.FOUNDEROS_DELIVERY_PYTHON_BIN ?? "python3";

type DeliveryLaunchProof = {
  url: string;
  observedAt: string;
};

type LaunchTarget = {
  launchManifestPath: string;
  launchProofKind: DeliveryLaunchProofKind;
  launchTargetLabel: string;
  workingDirectory: string;
  entryPath: string;
  expectedMarker: string;
  command: string[];
  shellCommand: string;
};

type DeliveryLaunchManifest = {
  version?: 1;
  launcher: "python_static_site";
  scriptPath: string;
  workingDirectory: string;
  entryPath: string;
  entrypoint?: string;
  expectedMarker: string;
  targetKind: DeliveryLaunchProofKind;
  targetLabel: string;
  proofKind?: DeliveryLaunchProofKind;
  prompt?: string;
  generatedAt?: string;
  launchCommand?: string;
  previewUrl?: string | null;
  previewUrlObservedAt?: string | null;
  files?: string[];
  sourceWorkUnits?: Array<{
    id: string;
    title: string;
    attemptId: string;
    scopePaths: string[];
    acceptanceCriteria: string[];
  }>;
  command: string[];
  shellCommand: string;
  proof: {
    status: "passed" | "failed";
    url?: string | null;
    observedAt?: string | null;
  };
};

function cloneDelivery(value: DeliveryRecord) {
  return JSON.parse(JSON.stringify(value)) as DeliveryRecord;
}

export type DeliveryPromotionState =
  | "attempt_scaffold"
  | "assembly_ready"
  | "verification_passed"
  | "runnable_result"
  | "delivery.ready";

export type DeliveryPromotionInput = {
  assemblyReady: boolean;
  verificationPassed: boolean;
  launchProofKind?: DeliveryLaunchProofKind | null;
  launchProofUrl?: string | null;
  launchProofAt?: string | null;
};

export function resolveDeliveryPromotionState(
  input: DeliveryPromotionInput
): DeliveryPromotionState {
  if (!input.assemblyReady) {
    return "attempt_scaffold";
  }

  if (!input.verificationPassed) {
    return "assembly_ready";
  }

  if (input.launchProofKind !== "runnable_result") {
    return "verification_passed";
  }

  if (!input.launchProofUrl || !input.launchProofAt) {
    return "runnable_result";
  }

  return "delivery.ready";
}

export function canPersistReadyDelivery(input: DeliveryPromotionInput) {
  return resolveDeliveryPromotionState(input) === "delivery.ready";
}

export async function listDeliveries(filters?: { initiativeId?: string | null }) {
  const state = await readControlPlaneState();
  return [...state.orchestration.deliveries]
    .filter((delivery) => {
      if (filters?.initiativeId && delivery.initiativeId !== filters.initiativeId) {
        return false;
      }
      return true;
    })
    .sort((left, right) => {
      const leftAt = left.deliveredAt ?? left.id;
      const rightAt = right.deliveredAt ?? right.id;
      return rightAt.localeCompare(leftAt);
    })
    .map(cloneDelivery);
}

export async function buildDeliveriesDirectoryResponse(filters?: {
  initiativeId?: string | null;
}) {
  return {
    ...(await buildOrchestrationDirectoryMeta([
      "Deliveries are shell-owned final handoff records and only become ready after a passed verification plus runnable localhost proof.",
    ])),
    deliveries: await listDeliveries(filters),
  };
}

async function latestVerificationForInitiative(initiativeId: string) {
  const verifications = await listVerifications({ initiativeId });
  return verifications[0] ?? null;
}

async function findRunnableAttemptTarget(
  initiativeId: string,
  taskGraphId: string
) {
  const workUnits = await listOrchestrationWorkUnits({ taskGraphId });
  const preferred = [...workUnits].sort((left, right) => {
    const leftPriority = left.id.endsWith("final_integration")
      ? 0
      : left.id.endsWith("workspace_launch")
        ? 1
        : 2;
    const rightPriority = right.id.endsWith("final_integration")
      ? 0
      : right.id.endsWith("workspace_launch")
        ? 1
        : 2;
    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }
    return right.updatedAt.localeCompare(left.updatedAt);
  });

  for (const workUnit of preferred) {
    if (!workUnit.latestAttemptId) {
      continue;
    }

    materializeAttemptArtifacts({
      initiativeId,
      taskGraphId,
      batchId: null,
      workUnit,
      attemptId: workUnit.latestAttemptId,
    });

    const target = readRunnableAttemptTarget({
      initiativeId,
      attemptId: workUnit.latestAttemptId,
    });
    if (target) {
      return target;
    }
  }

  return null;
}

function shellQuote(value: string) {
  return `'${value.split("'").join(`'"'"'`)}'`;
}

function deliveryOutputLocation(initiativeId: string, deliveryId: string) {
  return path.join(
    resolveOrchestrationDeliveriesRoot(),
    initiativeId,
    deliveryId
  );
}

function launchScriptLocation(localOutputPath: string) {
  return path.join(localOutputPath, "launch-localhost.py");
}

function launchManifestLocation(localOutputPath: string) {
  return path.join(localOutputPath, "launch-manifest.json");
}

function isPathWithinDirectory(candidatePath: string, parentDirectory: string) {
  const relative = path.relative(parentDirectory, candidatePath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function isAssemblyBackedRunnableTarget(
  assembly: AssemblyRecord | null,
  target:
    | {
        workingDirectory: string;
        launchProofKind: DeliveryLaunchProofKind;
      }
    | null
) {
  if (!assembly?.outputLocation || !target || target.launchProofKind !== "runnable_result") {
    return false;
  }

  return isPathWithinDirectory(target.workingDirectory, assembly.outputLocation);
}

function buildLaunchScript() {
  return [
    "#!/usr/bin/env python3",
    "import argparse",
    "import functools",
    "import http.server",
    "import socketserver",
    "from pathlib import Path",
    "",
    "parser = argparse.ArgumentParser()",
    'parser.add_argument("--port", type=int, default=0)',
    'parser.add_argument("--bind", default="127.0.0.1")',
    'parser.add_argument("--entry", default="/preview.html")',
    "args = parser.parse_args()",
    "",
    "directory = str(Path(__file__).resolve().parent)",
    "",
    "class ReusableTCPServer(socketserver.TCPServer):",
    "    allow_reuse_address = True",
    "",
    "handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=directory)",
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

function escapeHtml(value: string | null | undefined) {
  return (value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizePrompt(value: string | null | undefined) {
  return (value ?? "").trim() || "Build a small local web app.";
}

function deriveRunnableAppKind(prompt: string) {
  const normalized = prompt.toLowerCase();
  if (normalized.includes("invoice")) {
    return "invoice_generator" as const;
  }
  if (
    normalized.includes("tip") ||
    normalized.includes("gratuity") ||
    normalized.includes("bill amount")
  ) {
    return "tip_calculator" as const;
  }
  return "prompt_calculator" as const;
}

function buildTipCalculatorScript() {
  return [
    "(() => {",
    "  const amountInput = document.getElementById('bill-amount');",
    "  const tipInput = document.getElementById('tip-percent');",
    "  const tipOutput = document.getElementById('tip-amount');",
    "  const totalOutput = document.getElementById('tip-result');",
    "  const formatMoney = (value) => value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });",
    "  function calculateTip() {",
    "    const amount = Number.parseFloat(amountInput.value || '0');",
    "    const tipPercent = Number.parseFloat(tipInput.value || '0');",
    "    const safeAmount = Number.isFinite(amount) ? amount : 0;",
    "    const safePercent = Number.isFinite(tipPercent) ? tipPercent : 0;",
    "    const tip = safeAmount * safePercent / 100;",
    "    const total = safeAmount + tip;",
    "    tipOutput.textContent = formatMoney(tip);",
    "    totalOutput.textContent = formatMoney(total);",
    "    return { amount: safeAmount, tipPercent: safePercent, tip, total };",
    "  }",
    "  amountInput.addEventListener('input', calculateTip);",
    "  tipInput.addEventListener('input', calculateTip);",
    "  window.__INFINITY_RUNNABLE_APP__ = { kind: 'tip_calculator', calculateTip };",
    "  calculateTip();",
    "})();",
  ].join("\n");
}

function buildInvoiceGeneratorScript() {
  return [
    "(() => {",
    "  const clientInput = document.getElementById('client-name');",
    "  const amountInput = document.getElementById('line-item-amount');",
    "  const taxInput = document.getElementById('tax-percent');",
    "  const clientOutput = document.getElementById('invoice-client-output');",
    "  const taxOutput = document.getElementById('invoice-tax-output');",
    "  const totalOutput = document.getElementById('invoice-total');",
    "  const formatMoney = (value) => value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });",
    "  function calculateInvoice() {",
    "    const amount = Number.parseFloat(amountInput.value || '0');",
    "    const taxPercent = Number.parseFloat(taxInput.value || '0');",
    "    const safeAmount = Number.isFinite(amount) ? amount : 0;",
    "    const safeTaxPercent = Number.isFinite(taxPercent) ? taxPercent : 0;",
    "    const tax = safeAmount * safeTaxPercent / 100;",
    "    const total = safeAmount + tax;",
    "    clientOutput.textContent = clientInput.value.trim() || 'Draft client';",
    "    taxOutput.textContent = formatMoney(tax);",
    "    totalOutput.textContent = formatMoney(total);",
    "    return { amount: safeAmount, taxPercent: safeTaxPercent, tax, total };",
    "  }",
    "  clientInput.addEventListener('input', calculateInvoice);",
    "  amountInput.addEventListener('input', calculateInvoice);",
    "  taxInput.addEventListener('input', calculateInvoice);",
    "  window.__INFINITY_RUNNABLE_APP__ = { kind: 'invoice_generator', calculateInvoice };",
    "  calculateInvoice();",
    "})();",
  ].join("\n");
}

function buildGenericCalculatorScript() {
  return [
    "(() => {",
    "  const valueInput = document.getElementById('prompt-value');",
    "  const multiplierInput = document.getElementById('prompt-multiplier');",
    "  const resultOutput = document.getElementById('prompt-result');",
    "  function calculatePromptResult() {",
    "    const value = Number.parseFloat(valueInput.value || '0');",
    "    const multiplier = Number.parseFloat(multiplierInput.value || '1');",
    "    const result = (Number.isFinite(value) ? value : 0) * (Number.isFinite(multiplier) ? multiplier : 1);",
    "    resultOutput.textContent = result.toFixed(2);",
    "    return { value, multiplier, result };",
    "  }",
    "  valueInput.addEventListener('input', calculatePromptResult);",
    "  multiplierInput.addEventListener('input', calculatePromptResult);",
    "  window.__INFINITY_RUNNABLE_APP__ = { kind: 'prompt_calculator', calculatePromptResult };",
    "  calculatePromptResult();",
    "})();",
  ].join("\n");
}

function buildRunnableAppScript(appKind: ReturnType<typeof deriveRunnableAppKind>) {
  if (appKind === "tip_calculator") {
    return buildTipCalculatorScript();
  }
  if (appKind === "invoice_generator") {
    return buildInvoiceGeneratorScript();
  }
  return buildGenericCalculatorScript();
}

function buildRunnableAppForm(appKind: ReturnType<typeof deriveRunnableAppKind>) {
  if (appKind === "tip_calculator") {
    return [
      '<label><span>Bill amount</span><input id="bill-amount" type="number" inputmode="decimal" min="0" step="0.01" value="42" /></label>',
      '<label><span>Tip percent</span><input id="tip-percent" type="number" inputmode="decimal" min="0" step="0.1" value="18" /></label>',
      '<div class="result-grid">',
      '  <div><span>Tip amount</span><strong id="tip-amount">$0.00</strong></div>',
      '  <div><span>Total with tip</span><strong id="tip-result">$0.00</strong></div>',
      "</div>",
    ].join("\n");
  }
  if (appKind === "invoice_generator") {
    return [
      '<label><span>Client name</span><input id="client-name" type="text" value="Acme Studio" /></label>',
      '<label><span>Line item amount</span><input id="line-item-amount" type="number" inputmode="decimal" min="0" step="0.01" value="240" /></label>',
      '<label><span>Tax percent</span><input id="tax-percent" type="number" inputmode="decimal" min="0" step="0.1" value="8.5" /></label>',
      '<div class="result-grid">',
      '  <div><span>Client</span><strong id="invoice-client-output">Draft client</strong></div>',
      '  <div><span>Tax</span><strong id="invoice-tax-output">$0.00</strong></div>',
      '  <div><span>Printable total</span><strong id="invoice-total">$0.00</strong></div>',
      "</div>",
    ].join("\n");
  }
  return [
    '<label><span>Value</span><input id="prompt-value" type="number" inputmode="decimal" value="12" /></label>',
    '<label><span>Multiplier</span><input id="prompt-multiplier" type="number" inputmode="decimal" value="3" /></label>',
    '<div class="result-grid"><div><span>Result</span><strong id="prompt-result">0.00</strong></div></div>',
  ].join("\n");
}

function buildPromptDerivedIndexHtml(params: {
  appKind: ReturnType<typeof deriveRunnableAppKind>;
  appScript: string;
  expectedMarker: string;
  prompt: string;
  title: string;
}) {
  const productLabel =
    params.appKind === "tip_calculator"
      ? "Tip calculator"
      : params.appKind === "invoice_generator"
        ? "Invoice generator"
        : "Prompt calculator";

  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '  <meta charset="utf-8" />',
    `  <title>${escapeHtml(productLabel)}</title>`,
    '  <meta name="viewport" content="width=device-width, initial-scale=1" />',
    "  <style>",
    "    * { box-sizing: border-box; }",
    "    body { margin: 0; min-height: 100vh; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #101316; color: #f5f7f8; }",
    "    main { min-height: 100vh; display: grid; place-items: center; padding: 28px; }",
    "    .app { width: min(760px, 100%); display: grid; gap: 18px; }",
    "    .eyebrow { font-size: 11px; text-transform: uppercase; letter-spacing: 0.14em; color: #9eddbf; }",
    "    h1 { margin: 8px 0 0; font-size: 34px; line-height: 1.08; }",
    "    p { margin: 10px 0 0; color: rgba(245,247,248,0.72); line-height: 1.65; }",
    "    .panel { border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04); border-radius: 8px; padding: 22px; }",
    "    form { display: grid; gap: 14px; }",
    "    label { display: grid; gap: 7px; color: rgba(245,247,248,0.72); font-size: 13px; }",
    "    input { width: 100%; border: 1px solid rgba(255,255,255,0.14); border-radius: 8px; background: #0b0d0f; color: #fff; padding: 12px 13px; font-size: 15px; }",
    "    .result-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 12px; }",
    "    .result-grid > div { border: 1px solid rgba(158,221,191,0.22); border-radius: 8px; background: rgba(158,221,191,0.08); padding: 14px; }",
    "    .result-grid span { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: rgba(245,247,248,0.58); }",
    "    .result-grid strong { display: block; margin-top: 8px; font-size: 24px; }",
    "    .prompt { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; color: rgba(245,247,248,0.64); word-break: break-word; }",
    "    .marker { position: absolute; opacity: 0; pointer-events: none; }",
    "    @media (max-width: 680px) { .result-grid { grid-template-columns: 1fr; } h1 { font-size: 28px; } }",
    "  </style>",
    "</head>",
    "<body>",
    "  <main>",
    '    <section class="app">',
    '      <div class="panel">',
    `        <div class="eyebrow">${escapeHtml(productLabel)} - prompt-derived runnable result</div>`,
    `        <h1>${escapeHtml(productLabel)}</h1>`,
    `        <p class="prompt">${escapeHtml(params.prompt)}</p>`,
    "      </div>",
    '      <form class="panel" onsubmit="return false;">',
    buildRunnableAppForm(params.appKind),
    "      </form>",
    `      <div class="marker">${escapeHtml(params.expectedMarker)}</div>`,
    "    </section>",
    "  </main>",
    "  <script>",
    params.appScript,
    "  </script>",
    "</body>",
    "</html>",
  ].join("\n");
}

function resolveRunnableResultTitle(params: { prompt: string; title: string }) {
  const title = params.title.trim();
  const prompt = normalizePrompt(params.prompt);
  if (title.endsWith("...") && prompt.length > title.length) {
    return prompt;
  }
  return title || prompt || "Generated runnable result";
}

async function materializeAssemblyRunnableTarget(params: {
  assembly: AssemblyRecord;
  initiativeId: string;
  verificationId: string;
  prompt: string;
  title: string;
  sourceWorkUnits: readonly WorkUnitRecord[];
}) {
  if (!params.assembly.outputLocation) {
    return null;
  }

  const outputDir = path.join(params.assembly.outputLocation, "runnable-result");
  await mkdir(outputDir, { recursive: true });

  const launchScriptPath = path.join(outputDir, "launch-localhost.py");
  const launchManifestPath = path.join(outputDir, "launch-manifest.json");
  const resultManifestPath = path.join(outputDir, "result-manifest.json");
  const indexPath = path.join(outputDir, "index.html");
  const appScriptPath = path.join(outputDir, "app.js");
  const command = [DELIVERY_PYTHON_BIN, launchScriptPath, "--port", "0", "--entry", "/index.html"];
  const shellCommand = `${DELIVERY_PYTHON_BIN} ${shellQuote(launchScriptPath)} --port 0 --entry /index.html`;
  const generatedAt = nowIso();
  const prompt = normalizePrompt(params.prompt);
  const appKind = deriveRunnableAppKind(prompt);
  const title = resolveRunnableResultTitle({ prompt, title: params.title });
  const appScript = buildRunnableAppScript(appKind);
  const sourceWorkUnits = params.sourceWorkUnits.map((workUnit) => ({
    id: workUnit.id,
    title: workUnit.title,
    attemptId: workUnit.latestAttemptId ?? "",
    scopePaths: workUnit.scopePaths,
    acceptanceCriteria: workUnit.acceptanceCriteria,
  }));

  await writeFile(
    indexPath,
    buildPromptDerivedIndexHtml({
      appKind,
      appScript,
      expectedMarker: DELIVERY_RESULT_MARKER,
      prompt,
      title,
    })
  );
  await writeFile(appScriptPath, appScript);
  await writeFile(launchScriptPath, buildLaunchScript());
  await writeFile(
    launchManifestPath,
    JSON.stringify(
      {
        version: 1,
        launcher: "python_static_site",
        scriptPath: launchScriptPath,
        workingDirectory: outputDir,
        entryPath: "/index.html",
        entrypoint: "/index.html",
        expectedMarker: DELIVERY_RESULT_MARKER,
        targetKind: "runnable_result",
        targetLabel: "Integrated assembly result",
        proofKind: "runnable_result",
        prompt,
        generatedAt,
        launchCommand: shellCommand,
        previewUrl: null,
        previewUrlObservedAt: null,
        files: ["index.html", "app.js", "launch-localhost.py", "result-manifest.json"],
        sourceWorkUnits,
        appKind,
        command,
        shellCommand,
        proof: {
          status: "failed",
          url: null,
          observedAt: null,
        },
      },
      null,
      2
    )
  );
  await writeFile(
    resultManifestPath,
    JSON.stringify(
      {
        initiativeId: params.initiativeId,
        assemblyId: params.assembly.id,
        verificationId: params.verificationId,
        targetKind: "runnable_result",
        targetLabel: "Integrated assembly result",
        proofKind: "runnable_result",
        prompt,
        generatedAt,
        appKind,
        entrypoint: "/index.html",
        launchCommand: shellCommand,
        files: ["index.html", "app.js", "launch-localhost.py", "launch-manifest.json"],
        sourceWorkUnits,
        outputDir,
        entryPath: "/index.html",
      },
      null,
      2
    )
  );

  return {
    launchManifestPath,
    launchProofKind: "runnable_result" as const,
    launchTargetLabel: "Integrated assembly result",
    workingDirectory: outputDir,
    entryPath: "/index.html",
    expectedMarker: DELIVERY_RESULT_MARKER,
    command,
    shellCommand,
  } satisfies LaunchTarget;
}

async function proveLocalhostLaunch(
  command: string[],
  expectedMarker: string
): Promise<DeliveryLaunchProof | null> {
  return await new Promise((resolve) => {
    const child = spawn(command[0] ?? DELIVERY_PYTHON_BIN, command.slice(1), {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let settled = false;
    let verifying = false;
    let output = "";
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const finish = (proof: DeliveryLaunchProof | null) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timeout) {
        clearTimeout(timeout);
      }
      if (child.exitCode === null && child.signalCode === null) {
        child.kill("SIGTERM");
        setTimeout(() => {
          if (child.exitCode === null && child.signalCode === null) {
            child.kill("SIGKILL");
          }
        }, 400).unref();
      }
      resolve(proof);
    };

    const verifyUrl = async (url: string) => {
      try {
        const response = await fetch(url, { cache: "no-store" });
        const body = await response.text();
        if (!response.ok || !body.includes(expectedMarker)) {
          finish(null);
          return;
        }
        finish({
          url,
          observedAt: nowIso(),
        });
      } catch {
        finish(null);
      }
    };

    const onChunk = (chunk: string | Buffer) => {
      output += chunk.toString();
      const match = output.match(DELIVERY_READY_URL_PATTERN);
      if (!match || settled) {
        return;
      }
      verifying = true;
      const readyUrl = match[1];
      if (!readyUrl) {
        finish(null);
        return;
      }
      void verifyUrl(readyUrl);
    };

    timeout = setTimeout(() => finish(null), DELIVERY_LAUNCH_TIMEOUT_MS);
    timeout.unref();

    child.stdout.on("data", onChunk);
    child.stderr.on("data", onChunk);
    child.on("error", () => finish(null));
    child.on("exit", () => {
      if (!verifying) {
        finish(null);
      }
    });
  });
}

async function updateLaunchManifestProof(params: {
  manifestPath: string;
  launchProof: DeliveryLaunchProof | null;
}) {
  try {
    const raw = JSON.parse(await readFile(params.manifestPath, "utf8")) as Record<
      string,
      unknown
    >;
    if (raw.targetKind !== "runnable_result") {
      return;
    }

    await writeFile(
      params.manifestPath,
      JSON.stringify(
        {
          ...raw,
          previewUrl: params.launchProof?.url ?? null,
          previewUrlObservedAt: params.launchProof?.observedAt ?? null,
          proof: params.launchProof
            ? {
                status: "passed",
                url: params.launchProof.url,
                observedAt: params.launchProof.observedAt,
              }
            : {
                status: "failed",
                url: null,
                observedAt: null,
              },
        },
        null,
        2
      )
    );
  } catch {
    return;
  }
}

async function buildDeliveryFields(
  initiativeId: string,
  deliveryId: string,
  assembly: AssemblyRecord | null,
  verificationId: string,
  productContext: {
    prompt: string;
    title: string;
  }
): Promise<{
  localOutputPath: string;
  launchReady: boolean;
  manifestPath: string;
  previewPath: string;
  launchManifestPath: string;
  launchProofKind: DeliveryLaunchProofKind;
  launchTargetLabel: string;
  handoffSummaryPath: string;
  handoffManifestPath: string;
  handoffNotes: string;
  command: string;
  launchProofUrl: string | null;
  launchProofAt: string | null;
}> {
  const localOutputPath = deliveryOutputLocation(initiativeId, deliveryId);
  await mkdir(localOutputPath, { recursive: true });
  const previewPath = path.join(localOutputPath, "preview.html");
  const launchScriptPath = launchScriptLocation(localOutputPath);
  const wrapperLaunchManifestPath = launchManifestLocation(localOutputPath);
  const attemptRunnableTarget =
    assembly?.taskGraphId
      ? await findRunnableAttemptTarget(initiativeId, assembly.taskGraphId)
      : null;
  const sourceWorkUnits = assembly?.taskGraphId
    ? await listOrchestrationWorkUnits({ taskGraphId: assembly.taskGraphId })
    : [];
  const scaffoldOnlyTarget =
    attemptRunnableTarget && attemptRunnableTarget.launchProofKind === "attempt_scaffold";
  const attemptRunnableTargetBacked =
    isAssemblyBackedRunnableTarget(assembly, attemptRunnableTarget);
  const runnableTarget =
    attemptRunnableTargetBacked
      ? attemptRunnableTarget
      : assembly
        ? await materializeAssemblyRunnableTarget({
            assembly,
            initiativeId,
            verificationId,
            prompt: productContext.prompt,
            title: productContext.title,
            sourceWorkUnits,
          })
        : attemptRunnableTarget;
  const usedAssemblyRunnableTarget =
    Boolean(runnableTarget) && runnableTarget !== attemptRunnableTarget;
  const realRunnableTarget = isAssemblyBackedRunnableTarget(assembly, runnableTarget);
  const runnableTargetLabel = runnableTarget?.launchTargetLabel ?? "shell evidence wrapper";
  const previewHtml = [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '  <meta charset="utf-8" />',
    `  <title>Infinity Preview ${deliveryId}</title>`,
    '  <meta name="viewport" content="width=device-width, initial-scale=1" />',
    "  <style>",
    "    :root { color-scheme: dark; }",
    "    * { box-sizing: border-box; }",
    "    body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0d0f12; color: #edf0f3; }",
    "    .frame { min-height: 100vh; padding: 28px; background: #0d0f12; }",
    "    .shell { border: 1px solid rgba(255,255,255,0.08); border-radius: 22px; overflow: hidden; background: #111315; box-shadow: inset 0 1px 0 rgba(255,255,255,0.04); }",
    "    .topbar { display:flex; align-items:center; gap:10px; padding: 12px 16px; border-bottom:1px solid rgba(255,255,255,0.06); background: rgba(255,255,255,0.02); }",
    "    .dot { width: 8px; height: 8px; border-radius: 999px; background: rgba(255,255,255,0.14); }",
    "    .url { flex:1; display:flex; align-items:center; gap:8px; min-width:0; padding: 8px 12px; border:1px solid rgba(255,255,255,0.08); border-radius:999px; background: rgba(255,255,255,0.03); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; color: rgba(255,255,255,0.72); }",
    "    .live { width: 7px; height: 7px; border-radius: 999px; background: #49d18d; box-shadow: 0 0 8px rgba(73,209,141,0.45); }",
    "    .content { padding: 24px; display:grid; gap: 18px; }",
    "    .eyebrow { font-size: 10px; text-transform: uppercase; letter-spacing: 0.18em; color: rgba(255,255,255,0.45); }",
    "    .hero { display:grid; gap: 16px; grid-template-columns: 1.15fr 0.85fr; }",
    "    .panel { border:1px solid rgba(255,255,255,0.08); border-radius: 18px; background: rgba(255,255,255,0.025); padding: 20px; box-shadow: inset 0 1px 0 rgba(255,255,255,0.04); }",
    "    .title { margin: 10px 0 0; font-size: 30px; line-height: 1.08; letter-spacing: -0.05em; }",
    "    .body { margin-top: 12px; font-size: 14px; line-height: 1.7; color: rgba(255,255,255,0.64); }",
    "    .badge-row { display:flex; flex-wrap:wrap; gap: 8px; margin-top: 14px; }",
    "    .badge { display:inline-flex; align-items:center; gap:6px; padding: 5px 10px; border-radius: 999px; border:1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04); font-size: 11px; color: rgba(255,255,255,0.76); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }",
    "    .badge-ready { border-color: rgba(73,209,141,0.22); background: rgba(73,209,141,0.12); color: #bef0d6; }",
    "    .badge-warn { border-color: rgba(245,158,11,0.22); background: rgba(245,158,11,0.12); color: #fde3b5; }",
    "    .metric-strip { display:grid; grid-template-columns: repeat(4, minmax(0,1fr)); border:1px solid rgba(73,209,141,0.18); background: rgba(73,209,141,0.05); border-radius: 16px; overflow:hidden; }",
    "    .metric { padding: 14px 16px; border-right: 1px solid rgba(73,209,141,0.14); }",
    "    .metric:last-child { border-right: none; }",
    "    .metric .k { font-size: 10px; text-transform: uppercase; letter-spacing: 0.14em; color: rgba(190,240,214,0.62); }",
    "    .metric .v { margin-top: 8px; font-size: 20px; font-weight: 700; letter-spacing: -0.03em; }",
    "    .metric .d { margin-top: 4px; font-size: 11px; color: rgba(255,255,255,0.54); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }",
    "    .grid { display:grid; gap: 16px; grid-template-columns: 1.1fr 0.9fr; }",
    "    .list { display:grid; gap: 10px; }",
    "    .list-row { border:1px solid rgba(255,255,255,0.06); border-radius: 12px; background: rgba(255,255,255,0.02); padding: 12px 14px; }",
    "    .list-row .k { font-size:10px; text-transform: uppercase; letter-spacing:0.14em; color: rgba(255,255,255,0.45); }",
    "    .list-row .v { margin-top: 6px; font-size: 12px; line-height: 1.7; color: rgba(255,255,255,0.76); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; word-break: break-all; }",
    "    .summary { display:grid; gap: 10px; }",
    "    .summary-row { display:grid; grid-template-columns: 110px 90px 1fr; gap: 12px; align-items:center; border:1px solid rgba(255,255,255,0.06); border-radius: 12px; background: rgba(255,255,255,0.02); padding: 10px 12px; }",
    "    .summary-row .a { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; color: rgba(255,255,255,0.82); }",
    "    .summary-row .b { font-size: 11px; color: #bef0d6; }",
    "    .summary-row .c { font-size: 10.5px; color: rgba(255,255,255,0.48); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }",
    "    @media (max-width: 900px) { .hero, .grid { grid-template-columns: 1fr; } .metric-strip { grid-template-columns: 1fr 1fr; } }",
    "  </style>",
    "</head>",
    "<body>",
    '  <div class="frame">',
    '    <main class="shell">',
    '      <div class="topbar">',
    '        <span class="dot"></span><span class="dot"></span><span class="dot"></span>',
    '        <div class="url"><span class="live"></span><span>localhost wrapper preview</span></div>',
    '        <span style="font-size:11px;color:rgba(255,255,255,0.48);font-family:ui-monospace, SFMono-Regular, Menlo, monospace;">shell evidence</span>',
    "      </div>",
    '      <div class="content">',
    '        <div class="eyebrow">Infinity Local Preview</div>',
    '        <div class="hero">',
    '          <section class="panel">',
    `            <div class="title">Delivery ${deliveryId}</div>`,
    `            <div class="body">This shell-generated wrapper exposes local delivery evidence for <strong style="color:#fff;font-weight:600;">${initiativeId}</strong>.${
      realRunnableTarget
        ? usedAssemblyRunnableTarget
          ? ` A real runnable target was rebuilt from assembly output as <strong style="color:#fff;font-weight:600;">${runnableTargetLabel}</strong>.`
          : ` A real runnable target was detected as <strong style="color:#fff;font-weight:600;">${runnableTargetLabel}</strong>.`
        : scaffoldOnlyTarget
          ? ` The final integration attempt remains scaffold evidence, while the delivery bundle is rebuilt from assembly output as <strong style="color:#fff;font-weight:600;">${runnableTargetLabel}</strong>.`
          : runnableTarget?.launchProofKind === "runnable_result"
            ? ` A legacy runnable target was detected as <strong style="color:#fff;font-weight:600;">${runnableTargetLabel}</strong>, but it is not derived from assembly output, so ready promotion stays blocked.`
            : " It does not prove that the actual product result is runnable yet."
    }</div>`,
    '            <div class="badge-row">',
    '              <span class="badge badge-warn">wrapper evidence</span>',
    '              <span class="badge badge-ready">verification linked</span>',
    '              <span class="badge">handoff bundle staged</span>',
    "            </div>",
    "          </section>",
    '          <section class="panel">',
    '            <div class="eyebrow">Wrapper notes</div>',
    '            <div class="body" style="margin-top:10px;">Review the linked manifest, preview wrapper, and handoff bundle before any manual publish or release step.</div>',
    "          </section>",
    "        </div>",
    '        <div class="metric-strip">',
    '          <div class="metric"><div class="k">Status</div><div class="v">Pending</div><div class="d">wrapper evidence</div></div>',
    '          <div class="metric"><div class="k">Verification</div><div class="v">Passed</div><div class="d">linked</div></div>',
    '          <div class="metric"><div class="k">Artifacts</div><div class="v">Staged</div><div class="d">manifest + handoff bundle</div></div>',
    `          <div class="metric"><div class="k">Target</div><div class="v">${
      realRunnableTarget
        ? "Runnable"
        : scaffoldOnlyTarget
          ? "Scaffold"
          : runnableTarget?.launchProofKind === "runnable_result"
            ? "Unverified"
            : "Wrapper"
    }</div><div class="d">${runnableTargetLabel}</div></div>`,
    "        </div>",
    '        <div class="grid">',
    '          <section class="panel">',
    '            <div class="eyebrow">Changed files</div>',
    '            <div class="list" style="margin-top:12px;">',
    `              <div class="list-row"><div class="k">Preview</div><div class="v">${previewPath}</div></div>`,
    `              <div class="list-row"><div class="k">Launch manifest</div><div class="v">${wrapperLaunchManifestPath}</div></div>`,
    `              <div class="list-row"><div class="k">Handoff</div><div class="v">${path.join(localOutputPath, "HANDOFF.md")}</div></div>`,
    "            </div>",
    "          </section>",
    '          <section class="panel">',
    '            <div class="eyebrow">Validation</div>',
    '            <div class="summary" style="margin-top:12px;">',
    `              <div class="summary-row"><div class="a">verification</div><div class="b">passed</div><div class="c">${verificationId}</div></div>`,
    `              <div class="summary-row"><div class="a">assembly</div><div class="b">assembled</div><div class="c">${assembly?.id ?? "n/a"}</div></div>`,
    `              <div class="summary-row"><div class="a">output</div><div class="b">ready</div><div class="c">${assembly?.outputLocation ?? "n/a"}</div></div>`,
    `              <div class="summary-row"><div class="a">proof</div><div class="b">${
      realRunnableTarget
        ? "runnable"
        : scaffoldOnlyTarget
          ? "scaffold"
          : runnableTarget?.launchProofKind === "runnable_result"
            ? "unverified"
            : "wrapper"
    }</div><div class="c">${runnableTargetLabel}</div></div>`,
    "            </div>",
    "          </section>",
    "        </div>",
    "      </div>",
    "    </main>",
    "  </div>",
    "</body>",
    "</html>",
  ].join("\n");
  await writeFile(previewPath, previewHtml);
  await writeFile(launchScriptPath, buildLaunchScript());
  const wrapperLaunchCommand = [DELIVERY_PYTHON_BIN, launchScriptPath, "--port", "0"];
  const wrapperLaunchShellCommand = `${DELIVERY_PYTHON_BIN} ${shellQuote(launchScriptPath)} --port 0`;
  const wrapperLaunchProof = await proveLocalhostLaunch(
    wrapperLaunchCommand,
    LOCALHOST_PROOF_MARKER
  );
  const launchProofKind: DeliveryLaunchProofKind =
    runnableTarget?.launchProofKind ?? "synthetic_wrapper";
  const launchTargetLabel =
    runnableTarget?.launchTargetLabel ?? "Shell evidence wrapper";
  const launchManifestPath =
    runnableTarget?.launchManifestPath ?? wrapperLaunchManifestPath;
  const launchCommand = runnableTarget?.command ?? wrapperLaunchCommand;
  const launchShellCommand =
    runnableTarget?.shellCommand ?? wrapperLaunchShellCommand;
  const launchProof = runnableTarget
    ? await proveLocalhostLaunch(launchCommand, runnableTarget.expectedMarker)
    : wrapperLaunchProof;
  if (runnableTarget) {
    await updateLaunchManifestProof({
      manifestPath: runnableTarget.launchManifestPath,
      launchProof,
    });
  }
  const launchManifest: DeliveryLaunchManifest = {
    launcher: "python_static_site",
    scriptPath: launchScriptPath,
    workingDirectory: localOutputPath,
    entryPath: "/preview.html",
    expectedMarker: LOCALHOST_PROOF_MARKER,
    targetKind: "synthetic_wrapper",
    targetLabel: "Shell wrapper preview",
    command: wrapperLaunchCommand,
    shellCommand: wrapperLaunchShellCommand,
    proof: wrapperLaunchProof
      ? {
          status: "passed",
          url: wrapperLaunchProof.url,
          observedAt: wrapperLaunchProof.observedAt,
        }
      : {
          status: "failed",
          url: null,
          observedAt: null,
        },
  };
  await writeFile(wrapperLaunchManifestPath, JSON.stringify(launchManifest, null, 2));
  const launchReady =
    realRunnableTarget &&
    Boolean(launchProof?.url && launchProof?.observedAt);
  await writeFile(
    path.join(localOutputPath, "delivery-summary.json"),
    JSON.stringify(
      {
        initiativeId,
        deliveryId,
        verificationId,
        assemblyId: assembly?.id ?? null,
        assemblyOutputLocation: assembly?.outputLocation ?? null,
        launchManifestPath,
        launchProofKind,
        launchTargetLabel,
        launchCommand: launchShellCommand,
        launchProofUrl: launchProof?.url ?? null,
        launchProofAt: launchProof?.observedAt ?? null,
        note:
          launchReady
            ? "This local delivery handoff package is backed by a proven runnable localhost result."
            : "This is a local delivery handoff package with preview evidence only. It does not prove the actual product result is runnable yet.",
      },
      null,
      2
    )
  );
  await writeFile(
    path.join(localOutputPath, "HANDOFF.md"),
    [
      `# Delivery ${deliveryId}`,
      "",
      "This handoff package was prepared locally by the shell orchestration slice.",
      "Review the linked assembly output before performing any manual publish or release step.",
      "",
      `Verification: ${verificationId}`,
      `Assembly: ${assembly?.id ?? "n/a"}`,
      `Assembly output: ${assembly?.outputLocation ?? "n/a"}`,
      `Launch target: ${launchTargetLabel}`,
      `Launch command: ${launchShellCommand}`,
      `Launch proof: ${launchProof?.url ?? "not proven"}`,
      launchReady
        ? "Ready promotion is unlocked because a real runnable result was proven locally."
        : "Ready promotion stays blocked until a real runnable result is proven locally.",
    ].join("\n")
  );
  const handoffDir = path.join(localOutputPath, "handoff");
  await mkdir(handoffDir, { recursive: true });
  const handoffSummaryPath = path.join(handoffDir, "final-summary.md");
  const handoffManifestPath = path.join(handoffDir, "manifest.json");
  await writeFile(
    handoffSummaryPath,
    [
      `# Final Summary ${deliveryId}`,
      "",
      `Verification: ${verificationId}`,
      `Assembly: ${assembly?.id ?? "n/a"}`,
      `Assembly output: ${assembly?.outputLocation ?? "n/a"}`,
      "",
      "This packet was assembled automatically by the shell-owned autonomous loop.",
    ].join("\n")
  );
  await writeFile(
    handoffManifestPath,
    JSON.stringify(
      {
        deliveryId,
        initiativeId,
        verificationId,
        assemblyId: assembly?.id ?? null,
        previewPath,
        launchManifestPath,
        launchProofUrl: launchProof?.url ?? null,
      },
      null,
      2
    )
  );
  const durablePreviewPath =
    runnableTarget && launchProof
      ? path.join(
          runnableTarget.workingDirectory,
          runnableTarget.entryPath.replace(/^\/+/, "")
        )
      : previewPath;

  return {
    localOutputPath,
    launchReady,
    manifestPath: path.join(localOutputPath, "delivery-manifest.json"),
    previewPath: durablePreviewPath,
    launchManifestPath,
    launchProofKind,
    launchTargetLabel,
    handoffSummaryPath,
    handoffManifestPath,
    handoffNotes: launchReady
      ? "Review the linked assembly manifest, runnable result, and handoff bundle before any manual publish or release step."
      : scaffoldOnlyTarget
        ? "Review the linked assembly manifest, attempt scaffold, and handoff bundle before any manual publish or release step. A real runnable result still needs separate proof."
        : "Review the linked assembly manifest, shell evidence wrapper, and handoff bundle before any manual publish or release step. A real runnable result still needs separate proof.",
    command: launchShellCommand,
    launchProofUrl: launchProof?.url ?? null,
    launchProofAt: launchProof?.observedAt ?? null,
  };
}

export async function createDelivery(input: { initiativeId: string }): Promise<DeliveryMutationResponse | null> {
  const verification = await latestVerificationForInitiative(input.initiativeId);
  if (!verification || verification.overallStatus !== "passed") {
    return null;
  }

  if (!verification.assemblyId) {
    return null;
  }

  const assembly =
    (await listAssemblies({ initiativeId: input.initiativeId })).find(
      (candidate) => candidate.id === verification.assemblyId
    ) ?? null;
  if (!assembly) {
    return null;
  }
  const state = await readControlPlaneState();
  const initiative =
    state.orchestration.initiatives.find(
      (candidate) => candidate.id === input.initiativeId
    ) ?? null;
  const existingDelivery =
    (await listDeliveries({ initiativeId: input.initiativeId })).find(
      (candidate) => candidate.verificationRunId === verification.id
    ) ?? null;
  if (existingDelivery?.status === "ready") {
    return {
      ...(await buildOrchestrationDirectoryMeta([
        `Delivery ${existingDelivery.id} already exists for initiative ${input.initiativeId}.`,
      ])),
      delivery: existingDelivery,
      verification,
      assembly,
    };
  }
  const occurredAt = nowIso();
  const deliveryId = existingDelivery?.id ?? buildOrchestrationId("delivery");
  const previewId = buildOrchestrationId("preview");
  const fields = await buildDeliveryFields(
    input.initiativeId,
    deliveryId,
    assembly,
    verification.id,
    {
      prompt: initiative?.userRequest ?? input.initiativeId,
      title: initiative?.title ?? "Generated runnable result",
    }
  );
  const launchReady =
    fields.launchReady &&
    canPersistReadyDelivery({
      assemblyReady: Boolean(assembly),
      verificationPassed: verification.overallStatus === "passed",
      launchProofKind: fields.launchProofKind,
      launchProofUrl: fields.launchProofUrl,
      launchProofAt: fields.launchProofAt,
    });
  const delivery: DeliveryRecord = {
    id: deliveryId,
    initiativeId: input.initiativeId,
    verificationRunId: verification.id,
    taskGraphId: assembly.taskGraphId,
    resultSummary:
      launchReady
        ? "Runnable localhost delivery bundle backed by verified assembly evidence."
        : fields.launchProofKind === "attempt_scaffold"
          ? `Attempt scaffold preview and handoff bundle were prepared for initiative ${input.initiativeId}, but the requested product is still unproven as a real runnable result.`
          : `Evidence wrapper and handoff bundle were prepared for initiative ${input.initiativeId}, but the actual runnable result is still unproven.`,
    localOutputPath: fields.localOutputPath,
    manifestPath: fields.manifestPath,
    previewUrl: null,
    launchManifestPath: fields.launchManifestPath,
    launchProofKind: fields.launchProofKind,
    launchTargetLabel: fields.launchTargetLabel,
    launchProofUrl: fields.launchProofUrl,
    launchProofAt: fields.launchProofAt,
    handoffNotes: fields.handoffNotes,
    command: fields.command,
    status: launchReady ? "ready" : "pending",
    deliveredAt: occurredAt,
  };

  await updateControlPlaneState((draft) => {
    const preview = upsertPreviewTargetRecord(draft, input.initiativeId, {
      previewId,
      deliveryId: delivery.id,
      sourcePath: fields.previewPath,
      launchCommand: delivery.command ?? null,
      healthStatus: "ready",
    });
    const handoff = upsertHandoffPacketRecord(draft, input.initiativeId, {
      deliveryId: delivery.id,
      rootPath: fields.localOutputPath,
      finalSummaryPath: fields.handoffSummaryPath,
      manifestPath: fields.handoffManifestPath,
      status: launchReady ? "ready" : "building",
    });
    delivery.previewUrl = preview?.url ?? null;
    draft.orchestration.deliveries = [
      delivery,
      ...draft.orchestration.deliveries.filter(
        (candidate) =>
          !(
            candidate.initiativeId === input.initiativeId &&
            candidate.verificationRunId === verification.id
          )
      ),
    ];
    draft.orchestration.initiatives = draft.orchestration.initiatives.map((initiative) =>
      initiative.id === input.initiativeId
        ? {
            ...initiative,
            status: launchReady ? "ready" : "verifying",
            updatedAt: occurredAt,
          }
        : initiative
    );
    updateAutonomousRunStage(draft, input.initiativeId, {
      stage: launchReady ? "handed_off" : preview ? "preview_ready" : "delivering",
      health: launchReady ? "healthy" : "degraded",
      previewStatus: preview ? "ready" : "failed",
      handoffStatus: launchReady ? (handoff ? "ready" : "failed") : handoff ? "building" : "failed",
      completedAt: launchReady && handoff ? occurredAt : null,
    });
    appendAutonomousRunEvent(draft, input.initiativeId, {
      kind: "delivery.started",
      stage: "delivering",
      summary: `Delivery ${delivery.id} started.`,
      payload: {
        deliveryId: delivery.id,
      },
    });
    appendAutonomousRunEvent(draft, input.initiativeId, {
      kind: launchReady ? "delivery.ready" : "delivery.partial",
      stage: launchReady ? "preview_ready" : preview ? "preview_ready" : "delivering",
      summary: launchReady
        ? `Delivery ${delivery.id} is ready with localhost launch proof.`
        : fields.launchProofKind === "attempt_scaffold"
          ? `Delivery ${delivery.id} has attempt scaffold evidence and handoff metadata, but no real runnable result proof yet.`
          : `Delivery ${delivery.id} has shell wrapper evidence and handoff metadata, but no real runnable result proof yet.`,
      payload: {
        deliveryId: delivery.id,
        localOutputPath: delivery.localOutputPath,
        launchManifestPath: delivery.launchManifestPath,
        launchProofKind: delivery.launchProofKind,
        launchTargetLabel: delivery.launchTargetLabel,
        launchProofUrl: delivery.launchProofUrl,
      },
    });
    if (preview) {
      appendAutonomousRunEvent(draft, input.initiativeId, {
        kind: "preview.ready",
        stage: launchReady ? "preview_ready" : "preview_ready",
        summary: launchReady
          ? `Preview ${preview.id} is ready.`
          : fields.launchProofKind === "attempt_scaffold"
            ? `Preview ${preview.id} is available as attempt scaffold evidence only.`
            : `Preview ${preview.id} is available as shell evidence wrapper only.`,
        payload: {
          previewId: preview.id,
          url: preview.url,
        },
      });
    }
    if (handoff && launchReady) {
      appendAutonomousRunEvent(draft, input.initiativeId, {
        kind: "handoff.ready",
        stage: launchReady ? "handed_off" : preview ? "preview_ready" : "delivering",
        summary: `Handoff packet ${handoff.id} is ready.`,
        payload: {
          handoffPacketId: handoff.id,
          manifestPath: handoff.manifestPath,
        },
      });
      appendAutonomousRunEvent(draft, input.initiativeId, {
        kind: "run.completed",
        stage: "handed_off",
        summary: `Run ${handoff.runId} completed with runnable localhost result and handoff ready.`,
        payload: {
          deliveryId: delivery.id,
          previewId: preview?.id ?? null,
          handoffPacketId: handoff.id,
        },
      });
    }
  });
  await writeDeliveryManifest({
    delivery,
    assembly,
    verification,
  });

  const nextState = await readControlPlaneState();
  const run = findAutonomousRunByInitiativeId(nextState, input.initiativeId);
  const preview =
    nextState.orchestration.previewTargets.find(
      (candidate) => candidate.deliveryId === delivery.id
    ) ?? null;
  const handoff =
    nextState.orchestration.handoffPackets.find(
      (candidate) => candidate.deliveryId === delivery.id
    ) ?? null;
  if (run && preview && handoff) {
    materializeDeliveryEvidence(run, delivery, preview, handoff);
    const proof = buildAutonomousValidationProof(nextState, input.initiativeId);
    if (proof) {
      await updateControlPlaneState((draft) => {
        upsertValidationProofRecord(draft, input.initiativeId, proof);
      });
    }
    syncAutonomousRunTimeline(await readControlPlaneState(), input.initiativeId);
  }

  return {
    ...(await buildOrchestrationDirectoryMeta([
      `Delivery ${delivery.id} was created for initiative ${input.initiativeId}.`,
    ])),
    delivery,
    verification,
    assembly,
  };
}
