#!/usr/bin/env node

import { mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const deploymentEnv = (process.env.FOUNDEROS_DEPLOYMENT_ENV ?? "local")
  .trim()
  .toLowerCase();

if (deploymentEnv === "production") {
  console.error(
    "scripts/start-localhost.mjs refuses FOUNDEROS_DEPLOYMENT_ENV=production. Use production process management with explicit non-local origins and secrets.",
  );
  process.exit(1);
}

const config = {
  shellHost: process.env.FOUNDEROS_WEB_HOST ?? "127.0.0.1",
  shellPort: process.env.FOUNDEROS_WEB_PORT ?? "3737",
  workUiHost: process.env.WORK_UI_HOST ?? "127.0.0.1",
  workUiPort: process.env.WORK_UI_PORT ?? "3101",
  kernelHost: process.env.EXECUTION_KERNEL_HOST ?? "127.0.0.1",
  kernelPort: process.env.EXECUTION_KERNEL_PORT ?? "8798",
};

const shellOrigin = `http://${config.shellHost}:${config.shellPort}`;
const workUiOrigin = `http://${config.workUiHost}:${config.workUiPort}`;
const kernelOrigin = `http://${config.kernelHost}:${config.kernelPort}`;
const stateDir =
  process.env.FOUNDEROS_CONTROL_PLANE_STATE_DIR ??
  path.join(rootDir, ".control-plane-state");

mkdirSync(stateDir, { recursive: true });

const sharedEnv = {
  ...process.env,
  FOUNDEROS_DEPLOYMENT_ENV: process.env.FOUNDEROS_DEPLOYMENT_ENV ?? "local",
  FOUNDEROS_INTEGRATION_ROOT: rootDir,
  FOUNDEROS_CONTROL_PLANE_STATE_DIR: stateDir,
  FOUNDEROS_WEB_HOST: config.shellHost,
  FOUNDEROS_WEB_PORT: config.shellPort,
  FOUNDEROS_SHELL_PUBLIC_ORIGIN:
    process.env.FOUNDEROS_SHELL_PUBLIC_ORIGIN ?? shellOrigin,
  FOUNDEROS_WORK_UI_BASE_URL:
    process.env.FOUNDEROS_WORK_UI_BASE_URL ?? workUiOrigin,
  FOUNDEROS_EXECUTION_KERNEL_BASE_URL:
    process.env.FOUNDEROS_EXECUTION_KERNEL_BASE_URL ?? kernelOrigin,
  FOUNDEROS_PRIVILEGED_API_ALLOWED_ORIGINS:
    process.env.FOUNDEROS_PRIVILEGED_API_ALLOWED_ORIGINS ??
    `${shellOrigin},${workUiOrigin}`,
  FOUNDEROS_WORKSPACE_LAUNCH_SECRET:
    process.env.FOUNDEROS_WORKSPACE_LAUNCH_SECRET ??
    "infinity-local-launch-secret",
  FOUNDEROS_WORKSPACE_SESSION_GRANT_SECRET:
    process.env.FOUNDEROS_WORKSPACE_SESSION_GRANT_SECRET ??
    "infinity-local-session-grant-secret",
  FOUNDEROS_WORKSPACE_SESSION_TOKEN_SECRET:
    process.env.FOUNDEROS_WORKSPACE_SESSION_TOKEN_SECRET ??
    "infinity-local-session-secret",
  FOUNDEROS_CONTROL_PLANE_OPERATOR_TOKEN:
    process.env.FOUNDEROS_CONTROL_PLANE_OPERATOR_TOKEN ??
    "infinity-local-operator-token",
  FOUNDEROS_CONTROL_PLANE_SERVICE_TOKEN:
    process.env.FOUNDEROS_CONTROL_PLANE_SERVICE_TOKEN ??
    "infinity-local-service-token",
};

function pipeOutput(stream, prefix) {
  if (!stream) return;
  let buffer = "";
  stream.on("data", (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line.length > 0) {
        console.log(`[${prefix}] ${line}`);
      }
    }
  });
  stream.on("end", () => {
    if (buffer.length > 0) {
      console.log(`[${prefix}] ${buffer}`);
    }
  });
}

function startProcess(name, command, env = sharedEnv) {
  const child = spawn("bash", ["-lc", command], {
    cwd: rootDir,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  pipeOutput(child.stdout, name);
  pipeOutput(child.stderr, name);
  return child;
}

const children = [
  startProcess(
    "kernel",
    `cd ${JSON.stringify(
      path.join(rootDir, "services", "execution-kernel"),
    )} && EXECUTION_KERNEL_ADDR=${config.kernelHost}:${config.kernelPort} go run ./cmd/execution-kernel`,
  ),
  startProcess("shell", `npm run dev --workspace @founderos/web`, sharedEnv),
  startProcess("work-ui", `npm run dev --workspace open-webui`, {
    ...sharedEnv,
    PUBLIC_FOUNDEROS_SHELL_ORIGIN:
      process.env.PUBLIC_FOUNDEROS_SHELL_ORIGIN ?? shellOrigin,
    WORK_UI_HOST: config.workUiHost,
    WORK_UI_PORT: config.workUiPort,
  }),
];

let shuttingDown = false;

function shutdown(signal = "SIGTERM") {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed && child.exitCode === null) {
      child.kill(signal);
    }
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("exit", () => shutdown("SIGTERM"));

console.log("Infinity localhost stack");
console.log(`- shell entry:         ${shellOrigin}/`);
console.log(`- work-ui internal:    ${workUiOrigin}/`);
console.log(`- kernel internal:     ${kernelOrigin}/healthz`);
console.log(`- state:   ${stateDir}`);
console.log(
  "- shell is the only user-facing entry; work-ui and kernel stay internal.",
);
console.log("Press Ctrl+C to stop.");

for (const child of children) {
  child.on("exit", (code, signal) => {
    if (shuttingDown) {
      return;
    }

    const detail =
      signal !== null ? `signal ${signal}` : `code ${code ?? "unknown"}`;
    console.error(`Process exited unexpectedly: ${detail}`);
    shutdown("SIGTERM");
    process.exitCode = typeof code === "number" ? code : 1;
  });
}
