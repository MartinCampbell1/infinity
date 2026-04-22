import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(__dirname, "..");
const contractPath = join(appRoot, "lib", "shell-browser-contract.json");
const contract = JSON.parse(readFileSync(contractPath, "utf8"));

const buildIdPath = join(appRoot, ".next", "BUILD_ID");
if (!existsSync(buildIdPath)) {
  console.error(
    "Missing production build for @founderos/web. Run `npm run build --workspace @founderos/web` first."
  );
  process.exit(1);
}

const stateDir = mkdtempSync(join(tmpdir(), "infinity-shell-smoke-"));
const port =
  process.env.FOUNDEROS_WEB_PORT ??
  String(3770 + Math.floor(Math.random() * 100));
const host = process.env.FOUNDEROS_WEB_HOST ?? "127.0.0.1";
const baseUrl = `http://${host}:${port}`;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function waitForServer(url, timeoutMs = 15000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Keep polling.
    }

    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
  }

  throw new Error(`Timed out waiting for shell server at ${url}.`);
}

async function fetchJson(path, init) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const json = await response.json();
  return { response, json };
}

async function fetchHtml(path, init) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const html = await response.text();
  return { response, html };
}

function signalServer(signal) {
  if (server.exitCode !== null || !server.pid) {
    return;
  }

  if (process.platform !== "win32") {
    try {
      process.kill(-server.pid, signal);
      return;
    } catch {
      // Fall back to the direct child process below.
    }
  }

  server.kill(signal);
}

async function waitForExit(timeoutMs) {
  if (server.exitCode !== null) {
    return true;
  }

  return new Promise((resolveExit) => {
    const onExit = () => {
      clearTimeout(timeoutId);
      resolveExit(true);
    };
    const timeoutId = setTimeout(() => {
      server.off("exit", onExit);
      resolveExit(false);
    }, timeoutMs);

    server.once("exit", onExit);
  });
}

const server = spawn("npm", ["run", "start"], {
  cwd: appRoot,
  env: {
    ...process.env,
    FOUNDEROS_CONTROL_PLANE_STATE_DIR: stateDir,
    FOUNDEROS_ENABLE_SYNTHETIC_STATE_SEEDS: "1",
    FOUNDEROS_WEB_HOST: host,
    FOUNDEROS_WEB_PORT: port,
  },
  detached: process.platform !== "win32",
  stdio: ["ignore", "pipe", "pipe"],
});

let lastStdout = "";
let lastStderr = "";
server.stdout.on("data", (chunk) => {
  lastStdout += chunk.toString();
  lastStdout = lastStdout.slice(-4000);
});
server.stderr.on("data", (chunk) => {
  lastStderr += chunk.toString();
  lastStderr = lastStderr.slice(-4000);
});

const teardown = async () => {
  if (!server.killed && server.exitCode === null) {
    signalServer("SIGINT");
    if (!(await waitForExit(2000))) {
      signalServer("SIGTERM");
      if (!(await waitForExit(2000))) {
        signalServer("SIGKILL");
        await waitForExit(1000);
      }
    }
  }

  server.stdout.destroy();
  server.stderr.destroy();
  server.unref();
  rmSync(stateDir, { recursive: true, force: true });
};

try {
  await waitForServer(`${baseUrl}${contract.liveRoutes.rootPage}`);

  const rootPage = await fetchHtml(contract.liveRoutes.rootPage);
  assert(
    rootPage.response.status === 200,
    "Root page must return 200."
  );
  assert(
    rootPage.response.url === `${baseUrl}/` || rootPage.response.url === `${baseUrl}`,
    "Root entry must stay shell-owned at /."
  );
  const rootPageFolded = rootPage.html.toLowerCase();
  assert(
    rootPageFolded.includes("start an autonomous run"),
    "Root entry must expose the run composer."
  );
  assert(
    rootPageFolded.includes("search runs, tasks, agents") &&
      rootPageFolded.includes("suggested prompts") &&
      rootPageFolded.includes("recent runs"),
    "Root entry must expose the accepted shell frontdoor anchors."
  );

  await waitForServer(`${baseUrl}${contract.liveRoutes.sessionsPage}`);

  const runsPage = await fetchHtml(contract.liveRoutes.runsPage);
  assert(runsPage.response.status === 200, "Runs page must return 200.");
  assert(runsPage.html.includes("Runs"), "Runs page HTML must include the runs heading.");

  const specPage = await fetchHtml(contract.liveRoutes.specPage);
  assert(specPage.response.status === 200, "Spec page must return 200.");
  assert(specPage.html.includes("Spec"), "Spec page HTML must include the spec heading.");

  const plannerPage = await fetchHtml(contract.liveRoutes.plannerPage);
  assert(plannerPage.response.status === 200, "Planner page must return 200.");
  assert(
    plannerPage.html.includes("Planner"),
    "Planner page HTML must include the planner heading."
  );

  const tasksPage = await fetchHtml(contract.liveRoutes.tasksPage);
  assert(tasksPage.response.status === 200, "Tasks page must return 200.");
  assert(tasksPage.html.includes("Tasks"), "Tasks page HTML must include the tasks heading.");

  const sessionsPage = await fetchHtml(contract.liveRoutes.sessionsPage);
  assert(sessionsPage.response.status === 200, "Sessions page must return 200.");
  assert(
    sessionsPage.html.includes("Sessions"),
    "Sessions page HTML must include the sessions heading."
  );

  const groupsPage = await fetchHtml(contract.liveRoutes.groupsPage);
  assert(groupsPage.response.status === 200, "Groups page must return 200.");
  assert(
    groupsPage.html.includes("Groups"),
    "Groups page HTML must include the groups heading."
  );

  const accountsPage = await fetchHtml(contract.liveRoutes.accountsPage);
  assert(accountsPage.response.status === 200, "Accounts page must return 200.");
  assert(
    accountsPage.html.includes("Accounts"),
    "Accounts page HTML must include the accounts heading."
  );

  const approvalsPage = await fetchHtml(contract.liveRoutes.approvalsPage);
  assert(approvalsPage.response.status === 200, "Approvals page must return 200.");
  assert(
    approvalsPage.html.includes("Approvals"),
    "Approvals page HTML must include the approvals heading."
  );

  const auditsPage = await fetchHtml(contract.liveRoutes.auditsPage);
  assert(auditsPage.response.status === 200, "Audits page must return 200.");
  assert(
    auditsPage.html.includes("Audits"),
    "Audits page HTML must include the audits heading."
  );

  const recoveriesPage = await fetchHtml(contract.liveRoutes.recoveriesPage);
  assert(recoveriesPage.response.status === 200, "Recoveries page must return 200.");
  assert(
    recoveriesPage.html.includes("Recoveries"),
    "Recoveries page HTML must include the recoveries heading."
  );

  const agentsPage = await fetchHtml(contract.liveRoutes.agentsPage);
  assert(agentsPage.response.status === 200, "Agents page must return 200.");
  assert(
    agentsPage.html.includes("Agents"),
    "Agents page HTML must include the agents heading."
  );

  const issuesPage = await fetchHtml(contract.liveRoutes.issuesPage);
  assert(issuesPage.response.status === 200, "Issues page must return 200.");
  assert(issuesPage.html.includes("Issues"), "Issues page HTML must include the issues heading.");

  const refusalsPage = await fetchHtml(contract.liveRoutes.refusalsPage);
  assert(refusalsPage.response.status === 200, "Refusals page must return 200.");
  assert(
    refusalsPage.html.includes("Refusals"),
    "Refusals page HTML must include the refusals heading."
  );

  const eventsPage = await fetchHtml(contract.liveRoutes.eventsPage);
  assert(eventsPage.response.status === 200, "Events page must return 200.");
  assert(eventsPage.html.includes("Events"), "Events page HTML must include the events heading.");

  const validationPage = await fetchHtml(contract.liveRoutes.validationPage);
  assert(validationPage.response.status === 200, "Validation page must return 200.");
  assert(
    validationPage.html.includes("Validation"),
    "Validation page HTML must include the validation heading."
  );

  const deliveriesPage = await fetchHtml(contract.liveRoutes.deliveriesPage);
  assert(deliveriesPage.response.status === 200, "Deliveries page must return 200.");
  assert(
    deliveriesPage.html.includes("Delivery"),
    "Deliveries page HTML must include the delivery heading."
  );

  const previewsPage = await fetchHtml(contract.liveRoutes.previewsPage);
  assert(previewsPage.response.status === 200, "Previews page must return 200.");
  assert(
    previewsPage.html.includes("Previews"),
    "Previews page HTML must include the previews heading."
  );

  const handoffsPage = await fetchHtml(contract.liveRoutes.handoffsPage);
  assert(handoffsPage.response.status === 200, "Handoffs page must return 200.");
  assert(
    handoffsPage.html.includes("Handoffs"),
    "Handoffs page HTML must include the handoffs heading."
  );

  const workspacePage = await fetchHtml(contract.liveRoutes.workspacePage);
  assert(workspacePage.response.status === 200, "Workspace page must return 200.");
  assert(
    workspacePage.html.includes("Execution / Workspace host"),
    "Workspace HTML must include the host surface header."
  );
  assert(
    workspacePage.html.includes("founderos_launch"),
    "Workspace HTML must include the FounderOS launch marker."
  );
  assert(
    workspacePage.html.includes("embedded=1"),
    "Workspace HTML must include embedded launch mode marker."
  );
  assert(
    workspacePage.html.includes("opened_from=execution_board"),
    "Workspace HTML must preserve opened_from launch context."
  );
  assert(
    workspacePage.html.includes("launch_token="),
    "Workspace HTML must include the signed workspace launch token in the embedded URL."
  );

  const launchTokenMatch = workspacePage.html.match(/launch_token=([^"&]+)/);
  assert(launchTokenMatch?.[1], "Workspace HTML must expose an embedded launch token.");

  const workspaceLaunchVerify = await fetchJson(contract.liveRoutes.workspaceLaunchVerify, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: decodeURIComponent(launchTokenMatch[1]),
      projectId: "project-atlas",
      sessionId: "session-2026-04-11-001",
      groupId: "group-ops-01",
      accountId: "account-chatgpt-01",
      workspaceId: "workspace-atlas-main",
      openedFrom: "execution_board",
    }),
  });
  assert(
    workspaceLaunchVerify.response.status === 200,
    "Workspace launch verification route must return 200."
  );
  assert(
    workspaceLaunchVerify.json.accepted === true &&
      workspaceLaunchVerify.json.state === "valid" &&
      workspaceLaunchVerify.json.canonicalTruth === "sessionId" &&
      workspaceLaunchVerify.json.sessionId === "session-2026-04-11-001" &&
      typeof workspaceLaunchVerify.json.issuedAt === "string" &&
      workspaceLaunchVerify.json.issuedAt.length > 0 &&
      typeof workspaceLaunchVerify.json.expiresAt === "string" &&
      workspaceLaunchVerify.json.expiresAt.length > 0,
    "Workspace launch verification route must accept the shell-issued launch token."
  );

  const workspaceLaunchBootstrap = await fetchJson(
    contract.liveRoutes.workspaceLaunchBootstrap,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: decodeURIComponent(launchTokenMatch[1]),
        projectId: "project-atlas",
        sessionId: "session-2026-04-11-001",
        groupId: "group-ops-01",
        accountId: "account-chatgpt-01",
        workspaceId: "workspace-atlas-main",
        openedFrom: "execution_board",
      }),
    }
  );
  assert(
    workspaceLaunchBootstrap.response.status === 200,
    "Workspace bootstrap route must return 200 for a valid shell-issued launch token."
  );
  assert(
    workspaceLaunchBootstrap.json.accepted === true &&
      workspaceLaunchBootstrap.json.canonicalTruth === "sessionId" &&
      workspaceLaunchBootstrap.json.hostContext?.sessionId ===
        "session-2026-04-11-001" &&
      workspaceLaunchBootstrap.json.user?.email === "operator@infinity.local" &&
      Array.isArray(workspaceLaunchBootstrap.json.ui?.models) &&
      workspaceLaunchBootstrap.json.ui.models.length >= 1,
    "Workspace bootstrap route must return a shell-authored embedded hydration payload."
  );
  const workspaceRolloutStatus = await fetchJson(
    contract.liveRoutes.workspaceRolloutStatus
  );
  assert(
    workspaceRolloutStatus.response.status === 200,
    "Workspace rollout-status route must return 200."
  );
  assert(
    workspaceRolloutStatus.json.canonicalTruth === "sessionId" &&
      typeof workspaceRolloutStatus.json.shellPublicOrigin === "string" &&
      typeof workspaceRolloutStatus.json.workUiBaseUrl === "string" &&
      (workspaceRolloutStatus.json.sessionAuthMode === "bootstrap_only" ||
        workspaceRolloutStatus.json.sessionAuthMode === "shell_issued"),
    "Workspace rollout-status route must expose shell/work-ui launch readiness fields."
  );
  assert(
    workspaceLaunchBootstrap.json.auth?.mode === "session_exchange" &&
      !Object.prototype.hasOwnProperty.call(
        workspaceLaunchBootstrap.json.auth ?? {},
        "token"
      ) &&
      workspaceLaunchBootstrap.json.auth?.sessionExchangePath ===
        "/api/control/execution/workspace/session-2026-04-11-001/session",
    "Workspace bootstrap payload must omit inline credentials and point to the canonical session exchange route."
  );

  const workspaceSession = await fetchJson(contract.liveRoutes.workspaceSession, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: decodeURIComponent(launchTokenMatch[1]),
      projectId: "project-atlas",
      sessionId: "session-2026-04-11-001",
      groupId: "group-ops-01",
      accountId: "account-chatgpt-01",
      workspaceId: "workspace-atlas-main",
      openedFrom: "execution_board",
    }),
  });
  assert(
    workspaceSession.response.status === 200,
    "Workspace session route must return 200 for a valid shell-issued launch token."
  );
  assert(
    workspaceSession.json.accepted === true &&
      workspaceSession.json.canonicalTruth === "sessionId" &&
      workspaceSession.json.sessionId === "session-2026-04-11-001" &&
      typeof workspaceSession.json.user?.email === "string" &&
      typeof workspaceSession.json.session?.token === "string" &&
      typeof workspaceSession.json.session?.issuedAt === "string" &&
      typeof workspaceSession.json.session?.expiresAt === "string" &&
      typeof workspaceSession.json.sessionGrant?.token === "string" &&
      typeof workspaceSession.json.sessionGrant?.issuedAt === "string" &&
      typeof workspaceSession.json.sessionGrant?.expiresAt === "string",
    "Workspace session route must mint a shell-issued embedded session plus scoped session grant."
  );

  const workspaceSessionBearer = await fetchJson(
    contract.liveRoutes.workspaceSessionBearer,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: decodeURIComponent(launchTokenMatch[1]),
        projectId: "project-atlas",
        sessionId: "session-2026-04-11-001",
        groupId: "group-ops-01",
        accountId: "account-chatgpt-01",
        workspaceId: "workspace-atlas-main",
        openedFrom: "execution_board",
      }),
    }
  );
  assert(
    workspaceSessionBearer.response.status === 200,
    "Workspace session bearer compatibility route must return 200 for a valid shell-issued launch token."
  );
  assert(
    workspaceSessionBearer.json.accepted === true &&
      workspaceSessionBearer.json.canonicalTruth === "sessionId" &&
      workspaceSessionBearer.json.sessionId === "session-2026-04-11-001" &&
      typeof workspaceSessionBearer.json.sessionBearerToken === "string" &&
      typeof workspaceSessionBearer.json.sessionGrant?.token === "string" &&
      typeof workspaceSessionBearer.json.sessionGrant?.issuedAt === "string" &&
      typeof workspaceSessionBearer.json.sessionGrant?.expiresAt === "string",
    "Workspace session bearer compatibility route must still expose a shell-issued session token."
  );
  assert(
    workspaceRolloutStatus.json.sessionAuthMode === "shell_issued",
    "Workspace rollout status must advertise shell-issued embedded sessions as the active auth model."
  );

  const accountsDirectory = await fetchJson(contract.liveRoutes.accountsDirectory);
  assert(
    accountsDirectory.response.status === 200,
    "Accounts directory must return 200."
  );
  assert(
    accountsDirectory.json.storageKind === "file_backed" &&
      accountsDirectory.json.canonicalTruth === "sessionId",
    "Accounts directory must expose unified file-backed account capacity metadata."
  );
  assert(
    Array.isArray(accountsDirectory.json.accounts) &&
      accountsDirectory.json.accounts.length >= 3,
    "Accounts directory must include mock account rows."
  );
  assert(
    typeof accountsDirectory.json.preferredAccountId === "string",
    "Accounts directory must expose a preferred account."
  );

  const accountDetail = await fetchJson(contract.liveRoutes.accountDetail);
  assert(accountDetail.response.status === 200, "Account detail must return 200.");
  assert(
    accountDetail.json.account?.id === "account-chatgpt-01",
    "Account detail must preserve requested account id."
  );

  const accountQuotas = await fetchJson(
    `${contract.liveRoutes.accountQuotas}?includeUpdates=1&since=0`
  );
  assert(accountQuotas.response.status === 200, "Account quotas route must return 200.");
  assert(
    accountQuotas.json.canonicalQuotaSource === "openai_app_server",
    "Account quotas route must expose canonical quota source."
  );
  assert(
    Array.isArray(accountQuotas.json.snapshots) &&
      accountQuotas.json.snapshots.length >= 3,
    "Account quotas route must include snapshot rows."
  );
  assert(
    Array.isArray(accountQuotas.json.updates) &&
      accountQuotas.json.updates.length >= 1,
    "Account quotas route must include polling updates."
  );

  const quotaIngest = await fetchJson(contract.liveRoutes.accountQuotas, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      producer: "openai_app_server",
      snapshot: {
        accountId: "account-chatgpt-02",
        authMode: "chatgptAuthTokens",
        source: "openai_app_server",
        observedAt: "2026-04-11T15:05:00.000Z",
        buckets: [
          {
            limitId: "req_5h",
            limitName: "Requests / 5h",
            usedPercent: 91,
            windowDurationMins: 300,
            resetsAt: "2026-04-11T15:25:00.000Z",
          },
        ],
        raw: {
          endpoint: "account/rateLimits/updated",
          canonical: true,
        },
      },
      summary: "Smoke ingest raised quota pressure for account-chatgpt-02.",
    }),
  });
  assert(quotaIngest.response.status === 200, "Quota ingest route must return 200.");
  assert(
    quotaIngest.json.accepted === true &&
      quotaIngest.json.capacity?.pressure === "high" &&
      Array.isArray(quotaIngest.json.persistedEvents) &&
      quotaIngest.json.persistedEvents.some(
        (event) =>
          event.kind === "quota.updated" &&
          event.sessionId === "session-2026-04-11-002"
      ),
    "Quota ingest route must persist quota.updated events for affected sessions."
  );

  const shellExecutionEvents = await fetchJson(contract.liveRoutes.shellExecutionEvents);
  assert(
    shellExecutionEvents.response.status === 200,
    "Shell execution events route must return 200."
  );
  assert(
    shellExecutionEvents.json.events.some(
      (event) =>
        event.event === "quota.updated" &&
        event.orchestrator_session_id === "session-2026-04-11-002"
    ),
    "Shell execution events route must surface quota.updated after quota ingest."
  );

  const approvalsDirectory = await fetchJson(contract.liveRoutes.approvalsDirectory);
  assert(
    approvalsDirectory.response.status === 200,
    "Approvals directory must return 200."
  );
  assert(
    approvalsDirectory.json.storageKind === "file_backed" &&
      approvalsDirectory.json.canonicalTruth === "sessionId",
    "Approvals directory must expose file-backed approval metadata."
  );
  assert(
    approvalsDirectory.json.summary?.pending >= 1,
    "Approvals directory must include pending approvals."
  );

  const approvalDetail = await fetchJson(contract.liveRoutes.approvalDetail);
  assert(approvalDetail.response.status === 200, "Approval detail must return 200.");
  assert(
    approvalDetail.json.approvalRequest?.id === "approval-001",
    "Approval detail must preserve approval id."
  );

  const approvalRespond = await fetchJson(contract.liveRoutes.approvalRespond, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ decision: "approve_once" }),
  });
  assert(
    approvalRespond.response.status === 200,
    "Approval respond route must return 200."
  );
  assert(
    approvalRespond.json.accepted === true &&
      approvalRespond.json.approvalRequest?.decision === "approve_once",
    "Approval respond route must accept and persist the approval decision."
  );
  assert(
    approvalRespond.json.operatorAction?.id === "operator-action-001",
    "Approval respond route must expose the operator audit record."
  );

  const auditsDirectory = await fetchJson(contract.liveRoutes.auditsDirectory);
  assert(
    auditsDirectory.response.status === 200,
    "Audits directory must return 200."
  );
  assert(
    auditsDirectory.json.summary?.total >= 1 &&
      auditsDirectory.json.summary?.approvals >= 1,
    "Audits directory must expose approval-backed operator actions."
  );

  const auditDetail = await fetchJson(contract.liveRoutes.auditDetail);
  assert(auditDetail.response.status === 200, "Audit detail must return 200.");
  assert(
    auditDetail.json.auditEvent?.id === "operator-action-001" &&
      auditDetail.json.target?.targetKind === "approval_request",
    "Audit detail must preserve the approval-backed operator action and target."
  );

  const auditDetailPage = await fetchHtml(contract.liveRoutes.auditDetailPage);
  assert(
    auditDetailPage.response.status === 200,
    "Audit detail page must return 200."
  );

  const recoveriesDirectory = await fetchJson(contract.liveRoutes.recoveriesDirectory);
  assert(
    recoveriesDirectory.response.status === 200,
    "Recoveries directory must return 200."
  );
  assert(
    recoveriesDirectory.json.storageKind === "file_backed" &&
      recoveriesDirectory.json.canonicalTruth === "sessionId",
    "Recoveries directory must expose file-backed recovery metadata."
  );
  assert(
    recoveriesDirectory.json.summary?.retryable >= 1,
    "Recoveries directory must include retryable incidents."
  );

  const recoveryDetail = await fetchJson(contract.liveRoutes.recoveryDetail);
  assert(recoveryDetail.response.status === 200, "Recovery detail must return 200.");
  assert(
    recoveryDetail.json.recoveryIncident?.id === "recovery-001",
    "Recovery detail must preserve recovery id."
  );

  const recoveryAction = await fetchJson(contract.liveRoutes.recoveryAction, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ actionKind: "resolve" }),
  });
  assert(
    recoveryAction.response.status === 200,
    "Recovery action route must return 200."
  );
  assert(
    recoveryAction.json.accepted === true &&
      recoveryAction.json.recoveryIncident?.status === "recovered",
    "Recovery action route must accept and persist the resolve action."
  );
  assert(
    typeof recoveryAction.json.operatorAction?.id === "string",
    "Recovery action route must expose the operator audit record."
  );

  const auditsAfterRecovery = await fetchJson(contract.liveRoutes.auditsDirectory);
  assert(
    auditsAfterRecovery.response.status === 200,
    "Audits directory must still return 200 after recovery actions."
  );
  assert(
    auditsAfterRecovery.json.summary?.total >= 2 &&
      auditsAfterRecovery.json.summary?.approvals >= 1 &&
      auditsAfterRecovery.json.summary?.recoveries >= 1,
    "Audits directory must reflect both approval and recovery operator actions after recovery handling."
  );

  const workspaceRuntimeIngest = await fetchJson(
    contract.liveRoutes.workspaceRuntimeIngest,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hostContext: {
          projectId: "project-atlas",
          projectName: "Atlas Launch",
          sessionId: "session-2026-04-11-001",
          externalSessionId: "hermes-8842",
          groupId: "group-ops-01",
          workspaceId: "workspace-atlas-main",
          accountId: "account-chatgpt-01",
          accountLabel: "chatgpt 01",
          model: "gpt-4.1",
          executionMode: "hermes",
          quotaState: {
            pressure: "low",
            usedPercent: 32,
            resetsAt: "2026-04-11T15:00:00.000Z",
          },
          pendingApprovals: 0,
          openedFrom: "execution_board",
        },
        producer: "workspace_runtime_bridge",
        messages: [
          {
            type: "workspace.tool.started",
            payload: {
              toolName: "shell-bridge-smoke",
              eventId: "evt-smoke-001",
            },
          },
          {
            type: "workspace.tool.completed",
            payload: {
              toolName: "shell-bridge-smoke",
              eventId: "evt-smoke-001",
              status: "completed",
            },
          },
        ],
      }),
    }
  );
  assert(
    workspaceRuntimeIngest.response.status === 200,
    "Workspace runtime ingest route must return 200."
  );
  assert(
    workspaceRuntimeIngest.json.accepted === true &&
      Array.isArray(workspaceRuntimeIngest.json.persistedEvents) &&
      workspaceRuntimeIngest.json.persistedEvents.length === 2 &&
      workspaceRuntimeIngest.json.persistedEvents[0]?.kind === "tool.started" &&
      workspaceRuntimeIngest.json.persistedEvents[1]?.kind === "tool.completed" &&
      workspaceRuntimeIngest.json.runtimeSnapshot?.latestEvent?.kind === "tool.completed" &&
      workspaceRuntimeIngest.json.runtimeSnapshot?.session?.id === "session-2026-04-11-001",
    "Workspace runtime ingest route must persist supported workspace producer batches."
  );

  const sessionExecutionEvents = await fetchJson(
    "/api/shell/execution/events?orchestrator_session_id=session-2026-04-11-001&limit=40"
  );
  assert(
    sessionExecutionEvents.response.status === 200,
    "Session-specific execution events route must return 200."
  );
  assert(
    sessionExecutionEvents.json.events.every(
      (event) => event.orchestrator_session_id === "session-2026-04-11-001"
    ),
    "Session-specific execution events must preserve sessionId as the canonical filter key."
  );
  assert(
    sessionExecutionEvents.json.events.some(
      (event) => event.event === "approval.resolved" && event.approval_id === "approval-001"
    ) &&
      sessionExecutionEvents.json.events.some(
        (event) =>
          event.event === "recovery.completed" &&
          event.orchestrator_session_id === "session-2026-04-11-001"
      ) &&
      sessionExecutionEvents.json.events.some(
        (event) => event.event === "tool.completed" && event.tool_name === "shell-bridge-smoke"
      ),
    "Session-specific execution events must surface approval, recovery, and runtime tool activity in one feed."
  );

  console.log(
    JSON.stringify({
      status: "ok",
      baseUrl,
      stateDir,
      checked: contract.liveRoutes,
    })
  );
} catch (error) {
  console.error(
    JSON.stringify(
      {
        status: "error",
        baseUrl,
        error: error instanceof Error ? error.message : String(error),
        stdout: lastStdout,
        stderr: lastStderr,
      },
      null,
      2
    )
  );
  process.exitCode = 1;
} finally {
  await teardown();
}
