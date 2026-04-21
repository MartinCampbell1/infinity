import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  DeliveryRecord,
  DeliveryLaunchProofKind,
  AssemblyRecord,
  DeliveryMutationResponse,
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
import { readRunnableAttemptTarget } from "./attempt-artifacts";
import { listAssemblies } from "./assembly";
import { resolveOrchestrationDeliveriesRoot, writeDeliveryManifest } from "./artifacts";
import { listVerifications } from "./verification";
import { listOrchestrationWorkUnits } from "./work-units";
import { buildOrchestrationDirectoryMeta, buildOrchestrationId, nowIso } from "./shared";

const LOCALHOST_PROOF_MARKER = "Infinity Local Preview";
const DELIVERY_LAUNCH_TIMEOUT_MS = 8_000;
const DELIVERY_READY_URL_PATTERN = /READY\s+(http:\/\/127\.0\.0\.1:\d+\S+)/;
const DELIVERY_PYTHON_BIN = process.env.FOUNDEROS_DELIVERY_PYTHON_BIN ?? "python3";

type DeliveryLaunchProof = {
  url: string;
  observedAt: string;
};

type DeliveryLaunchManifest = {
  launcher: "python_static_site";
  scriptPath: string;
  workingDirectory: string;
  entryPath: "/preview.html";
  expectedMarker: string;
  targetKind: DeliveryLaunchProofKind;
  targetLabel: string;
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

async function buildDeliveryFields(
  initiativeId: string,
  deliveryId: string,
  assembly: AssemblyRecord | null,
  verificationId: string
): Promise<{
  localOutputPath: string;
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
  const runnableTarget =
    assembly?.taskGraphId
      ? await findRunnableAttemptTarget(initiativeId, assembly.taskGraphId)
      : null;
  const previewHtml = [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '  <meta charset="utf-8" />',
    `  <title>Infinity Preview ${deliveryId}</title>`,
    '  <meta name="viewport" content="width=device-width, initial-scale=1" />',
    "  <style>",
    "    body { font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; background: #f4efe6; color: #111827; }",
    "    main { max-width: 760px; margin: 48px auto; padding: 32px; background: rgba(255,255,255,0.92); border: 1px solid rgba(15,23,42,0.08); border-radius: 28px; box-shadow: 0 18px 48px rgba(15,23,42,0.08); }",
    "    h1 { margin: 0 0 12px; font-size: 30px; }",
    "    p, li { font-size: 15px; line-height: 1.7; }",
    "    code { background: rgba(15,23,42,0.06); border-radius: 999px; padding: 2px 8px; }",
    "    ul { padding-left: 20px; }",
    "  </style>",
    "</head>",
    "<body>",
    "  <main>",
    '    <div style="text-transform: uppercase; letter-spacing: 0.16em; font-size: 11px; color: #6b7280;">Infinity Local Preview</div>',
    `    <h1>Delivery ${deliveryId}</h1>`,
    `    <p>This local preview was generated by the shell-owned autonomous loop for <code>${initiativeId}</code>.</p>`,
    "    <ul>",
    `      <li>Verification: <code>${verificationId}</code></li>`,
    `      <li>Assembly: <code>${assembly?.id ?? "n/a"}</code></li>`,
    `      <li>Assembly output: <code>${assembly?.outputLocation ?? "n/a"}</code></li>`,
    "    </ul>",
    `    <p>This bundle exposes a shell-generated evidence wrapper.${runnableTarget ? ` The actual runnable target is <code>${runnableTarget.launchTargetLabel}</code>.` : " It does not prove that the actual product result is runnable yet."}</p>`,
    "  </main>",
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
  const launchManifest: DeliveryLaunchManifest = {
    launcher: "python_static_site",
    scriptPath: launchScriptPath,
    workingDirectory: localOutputPath,
    entryPath: "/preview.html",
    expectedMarker: LOCALHOST_PROOF_MARKER,
    targetKind: launchProofKind,
    targetLabel: launchTargetLabel,
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
          "This is a local delivery handoff package with a shell-generated evidence wrapper. It does not prove the actual product result is runnable yet.",
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
      "Ready promotion stays blocked until a real runnable result is proven locally.",
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

  return {
    localOutputPath,
    manifestPath: path.join(localOutputPath, "delivery-manifest.json"),
    previewPath,
    launchManifestPath,
    launchProofKind,
    launchTargetLabel,
    handoffSummaryPath,
    handoffManifestPath,
    handoffNotes:
      "Review the linked assembly manifest, shell evidence wrapper, and handoff bundle before any manual publish or release step. A real runnable result still needs separate proof.",
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

  const existing = (await listDeliveries({ initiativeId: input.initiativeId }))[0];
  if (existing && existing.verificationRunId === verification.id) {
    const assembly =
      (await listAssemblies({ initiativeId: input.initiativeId })).find(
        (candidate) => candidate.id === verification.assemblyId
      ) ?? null;
    return {
      ...(await buildOrchestrationDirectoryMeta([
        `Delivery ${existing.id} already exists for initiative ${input.initiativeId}.`,
      ])),
      delivery: existing,
      verification,
      assembly,
    };
  }

  const assembly =
    (await listAssemblies({ initiativeId: input.initiativeId })).find(
      (candidate) => candidate.id === verification.assemblyId
    ) ?? null;
  if (!assembly) {
    return null;
  }
  const occurredAt = nowIso();
  const deliveryId = buildOrchestrationId("delivery");
  const previewId = buildOrchestrationId("preview");
  const fields = await buildDeliveryFields(
    input.initiativeId,
    deliveryId,
    assembly,
    verification.id
  );
  const launchReady =
    fields.launchProofKind === "runnable_result" &&
    Boolean(fields.launchProofAt && fields.launchProofUrl);
  const delivery: DeliveryRecord = {
    id: deliveryId,
    initiativeId: input.initiativeId,
    verificationRunId: verification.id,
    taskGraphId: assembly.taskGraphId,
    resultSummary:
      launchReady
        ? "Runnable localhost delivery bundle backed by verified assembly evidence."
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
      status: "ready",
    });
    delivery.previewUrl = preview?.url ?? null;
    draft.orchestration.deliveries = [delivery, ...draft.orchestration.deliveries];
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
      handoffStatus: handoff ? "ready" : "failed",
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
          : `Preview ${preview.id} is available as shell evidence wrapper only.`,
        payload: {
          previewId: preview.id,
          url: preview.url,
        },
      });
    }
    if (handoff) {
      appendAutonomousRunEvent(draft, input.initiativeId, {
        kind: "handoff.ready",
        stage: launchReady ? "handed_off" : preview ? "preview_ready" : "delivering",
        summary: `Handoff packet ${handoff.id} is ready.`,
        payload: {
          handoffPacketId: handoff.id,
          manifestPath: handoff.manifestPath,
        },
      });
      if (launchReady) {
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
