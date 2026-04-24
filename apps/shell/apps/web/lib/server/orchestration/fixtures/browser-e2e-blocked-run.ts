import type { InitiativeContinuityResponse } from "../../control-plane/contracts/continuity";
import type { ControlPlaneState } from "../../control-plane/state/types";

const observedAt = "2026-04-24T00:00:00.000Z";

export const BROWSER_E2E_BLOCKED_RUN_IDS = {
  initiativeId: "initiative-1776973563494-orml3fx5",
  sessionId: "session-1776973563495-lr58pgeq",
  briefId: "brief-browser-e2e-blocked-tip-calculator",
  taskGraphId: "task-graph-browser-e2e-blocked-tip-calculator",
  batchId: "batch-browser-e2e-blocked-tip-calculator",
  assemblyId: "assembly-browser-e2e-blocked-tip-calculator",
  verificationId: "verification-browser-e2e-blocked-tip-calculator",
  runId: "run-browser-e2e-blocked-tip-calculator",
} as const;

const workUnits = [
  "intake",
  "brief",
  "task_graph",
  "workspace_launch",
  "calculator_form",
  "calculator_logic",
  "result_view",
  "verification",
  "final_integration",
].map((slug, index) => ({
  id: `work-unit-tip-calculator-${slug}`,
  taskGraphId: BROWSER_E2E_BLOCKED_RUN_IDS.taskGraphId,
  title: `Tip calculator ${slug.replaceAll("_", " ")}`,
  description: `Observed browser E2E work unit ${index + 1} for the tiny tip calculator run.`,
  executorType: "codex" as const,
  scopePaths: [
    "/Users/martin/infinity/apps/shell",
    "/Users/martin/infinity/apps/work-ui",
  ],
  dependencies:
    index === 0
      ? []
      : [
          `work-unit-tip-calculator-${
            [
              "intake",
              "brief",
              "task_graph",
              "workspace_launch",
              "calculator_form",
              "calculator_logic",
              "result_view",
              "verification",
            ][index - 1]
          }`,
        ],
  acceptanceCriteria: [
    "Work unit completed before verification blocked delivery.",
  ],
  estimatedComplexity: "small" as const,
  status: "completed" as const,
  latestAttemptId: `attempt-tip-calculator-${slug}`,
  createdAt: observedAt,
  updatedAt: observedAt,
}));

export const BROWSER_E2E_BLOCKED_RUN_STATE = {
  version: 1,
  seededAt: observedAt,
  approvals: {
    requests: [],
    operatorActions: [],
    actionSequence: 1,
  },
  recoveries: {
    incidents: [],
    operatorActions: [],
    actionSequence: 101,
  },
  accounts: {
    snapshots: [],
    updates: [],
  },
  sessions: {
    events: [],
  },
  tenancy: {
    tenants: [],
    users: [],
    memberships: [],
    projects: [],
    workspaces: [],
  },
  orchestration: {
    initiatives: [
      {
        id: BROWSER_E2E_BLOCKED_RUN_IDS.initiativeId,
        title: "Tiny tip calculator",
        userRequest: "Build a tiny tip calculator web app.",
        status: "failed" as const,
        requestedBy: "martin",
        workspaceSessionId: BROWSER_E2E_BLOCKED_RUN_IDS.sessionId,
        priority: "normal" as const,
        createdAt: observedAt,
        updatedAt: observedAt,
      },
    ],
    briefs: [
      {
        id: BROWSER_E2E_BLOCKED_RUN_IDS.briefId,
        initiativeId: BROWSER_E2E_BLOCKED_RUN_IDS.initiativeId,
        summary:
          "Build a tiny tip calculator with amount, tip percent, and visible total.",
        goals: ["Produce a previewable tip calculator app."],
        nonGoals: ["Public multi-user release."],
        constraints: ["Work only inside /Users/martin/infinity."],
        assumptions: [
          "Solo-local file-backed state is acceptable for this cycle.",
        ],
        acceptanceCriteria: [
          "Browser E2E reaches delivery.ready with a runnable_result preview.",
        ],
        repoScope: ["/Users/martin/infinity"],
        deliverables: ["Brief", "Task graph", "Runnable localhost preview"],
        clarificationLog: [],
        status: "approved" as const,
        authoredBy: "browser-e2e-audit",
        createdAt: observedAt,
        updatedAt: observedAt,
      },
    ],
    taskGraphs: [
      {
        id: BROWSER_E2E_BLOCKED_RUN_IDS.taskGraphId,
        initiativeId: BROWSER_E2E_BLOCKED_RUN_IDS.initiativeId,
        briefId: BROWSER_E2E_BLOCKED_RUN_IDS.briefId,
        version: 1,
        nodeIds: workUnits.map((workUnit) => workUnit.id),
        edges: workUnits.slice(1).map((workUnit, index) => ({
          from: workUnits[index]!.id,
          to: workUnit.id,
          kind: "depends_on" as const,
        })),
        status: "completed" as const,
        createdAt: observedAt,
        updatedAt: observedAt,
      },
    ],
    workUnits,
    batches: [
      {
        id: BROWSER_E2E_BLOCKED_RUN_IDS.batchId,
        initiativeId: BROWSER_E2E_BLOCKED_RUN_IDS.initiativeId,
        taskGraphId: BROWSER_E2E_BLOCKED_RUN_IDS.taskGraphId,
        workUnitIds: workUnits.map((workUnit) => workUnit.id),
        concurrencyLimit: 3,
        status: "completed" as const,
        startedAt: observedAt,
        finishedAt: observedAt,
      },
    ],
    supervisorActions: [],
    assemblies: [
      {
        id: BROWSER_E2E_BLOCKED_RUN_IDS.assemblyId,
        initiativeId: BROWSER_E2E_BLOCKED_RUN_IDS.initiativeId,
        taskGraphId: BROWSER_E2E_BLOCKED_RUN_IDS.taskGraphId,
        inputWorkUnitIds: workUnits.map((workUnit) => workUnit.id),
        artifactUris: [
          "file:///Users/martin/infinity/.local-state/orchestration/assemblies/tip-calculator/attempt-scaffold.json",
        ],
        outputLocation:
          "/Users/martin/infinity/.local-state/orchestration/assemblies/tip-calculator",
        manifestPath:
          "/Users/martin/infinity/.local-state/orchestration/assemblies/tip-calculator/manifest.json",
        summary:
          "All nine work units assembled, but verification blocked final delivery.",
        status: "assembled" as const,
        createdAt: observedAt,
        updatedAt: observedAt,
      },
    ],
    verifications: [
      {
        id: BROWSER_E2E_BLOCKED_RUN_IDS.verificationId,
        initiativeId: BROWSER_E2E_BLOCKED_RUN_IDS.initiativeId,
        assemblyId: BROWSER_E2E_BLOCKED_RUN_IDS.assemblyId,
        checks: [
          {
            name: "static_checks_passed",
            status: "passed" as const,
            details:
              "Static validation passed during the observed browser run.",
            command: "npm run shell:typecheck\nnpm run work-ui:check",
            cwd: "/Users/martin/infinity",
            exitCode: 0,
            stdoutSnippet: "Static checks passed.",
            stderrSnippet: null,
            artifactPath:
              "/Users/martin/infinity/.local-state/orchestration/verifications/tip-calculator/static.log",
          },
          {
            name: "targeted_tests_passed",
            status: "failed" as const,
            details:
              "npm run test:orchestration-readiness --workspace @founderos/web failed in the browser-created run while passing directly afterwards.",
            command:
              "npm run test:orchestration-readiness --workspace @founderos/web",
            cwd: "/Users/martin/infinity/apps/shell",
            exitCode: 1,
            stdoutSnippet: "All 9 work units completed before verification.",
            stderrSnippet:
              "targeted_tests_passed failed under inherited runtime validation environment.",
            artifactPath:
              "/Users/martin/infinity/.local-state/orchestration/verifications/tip-calculator/targeted-tests.log",
          },
        ],
        overallStatus: "failed" as const,
        startedAt: observedAt,
        finishedAt: observedAt,
      },
    ],
    deliveries: [],
    runs: [
      {
        id: BROWSER_E2E_BLOCKED_RUN_IDS.runId,
        initiativeId: BROWSER_E2E_BLOCKED_RUN_IDS.initiativeId,
        title: "Tiny tip calculator",
        originalPrompt: "Build a tiny tip calculator web app.",
        entryMode: "shell_chat" as const,
        currentStage: "blocked" as const,
        health: "blocked" as const,
        automationMode: "autonomous" as const,
        manualStageProgression: false,
        operatorOverrideActive: false,
        previewStatus: "none" as const,
        handoffStatus: "none" as const,
        createdAt: observedAt,
        updatedAt: observedAt,
        completedAt: null,
      },
    ],
    specDocs: [],
    agentSessions: workUnits.map((workUnit) => ({
      id: `agent-${workUnit.id}`,
      runId: BROWSER_E2E_BLOCKED_RUN_IDS.runId,
      batchId: BROWSER_E2E_BLOCKED_RUN_IDS.batchId,
      workItemId: workUnit.id,
      attemptId: workUnit.latestAttemptId,
      agentKind: "worker" as const,
      status: "completed" as const,
      runtimeRef: `codex://${workUnit.latestAttemptId}`,
      startedAt: observedAt,
      finishedAt: observedAt,
    })),
    refusals: [],
    runEvents: [
      {
        id: "event-browser-e2e-verification-blocked",
        runId: BROWSER_E2E_BLOCKED_RUN_IDS.runId,
        initiativeId: BROWSER_E2E_BLOCKED_RUN_IDS.initiativeId,
        kind: "verification.failed",
        stage: "blocked" as const,
        summary:
          "Verification failed on targeted_tests_passed; delivery remains null.",
        payload: {
          verificationId: BROWSER_E2E_BLOCKED_RUN_IDS.verificationId,
          failedChecks: ["targeted_tests_passed"],
          delivery: null,
        },
        createdAt: observedAt,
      },
    ],
    previewTargets: [],
    handoffPackets: [],
    validationProofs: [],
    secretPauses: [],
  },
  mutations: {
    events: [],
    idempotency: [],
  },
} satisfies ControlPlaneState;

const blockedInitiative =
  BROWSER_E2E_BLOCKED_RUN_STATE.orchestration.initiatives[0]!;
const blockedAssembly =
  BROWSER_E2E_BLOCKED_RUN_STATE.orchestration.assemblies[0]!;
const blockedVerification =
  BROWSER_E2E_BLOCKED_RUN_STATE.orchestration.verifications[0]!;

export const BROWSER_E2E_BLOCKED_RUN_CONTINUITY = {
  generatedAt: observedAt,
  source: "derived" as const,
  storageKind: "file_backed" as const,
  integrationState: "wired" as const,
  canonicalTruth: "sessionId" as const,
  notes: [
    "Regression fixture for the 2026-04-24 browser E2E run that completed work units but blocked delivery on verification.",
  ],
  initiative: blockedInitiative,
  briefs: BROWSER_E2E_BLOCKED_RUN_STATE.orchestration.briefs,
  taskGraphs: BROWSER_E2E_BLOCKED_RUN_STATE.orchestration.taskGraphs,
  batches: BROWSER_E2E_BLOCKED_RUN_STATE.orchestration.batches,
  assembly: blockedAssembly,
  verification: blockedVerification,
  delivery: null,
  relatedApprovals: [],
  relatedRecoveries: [],
  memoryAdapter: {
    enabled: true,
    baseUrl: "http://127.0.0.1:8766",
    healthPath: "/health",
    schemaPath: "/actions/schema",
    readActionPath: "/actions/knowledgebase",
    readActions: ["status", "search", "get_page", "get_claim", "query"],
    note: "Read-first continuity adapter over the Hermes memory sidecar; avoid direct DB/layout coupling.",
  },
  links: {
    continuityHref: `/execution/continuity/${BROWSER_E2E_BLOCKED_RUN_IDS.initiativeId}?session_id=${BROWSER_E2E_BLOCKED_RUN_IDS.sessionId}`,
    approvalsHref: `/execution/approvals?session_id=${BROWSER_E2E_BLOCKED_RUN_IDS.sessionId}`,
    recoveriesHref: `/execution/recoveries?session_id=${BROWSER_E2E_BLOCKED_RUN_IDS.sessionId}`,
    taskGraphHref: `/execution/task-graphs/${BROWSER_E2E_BLOCKED_RUN_IDS.taskGraphId}?initiative_id=${BROWSER_E2E_BLOCKED_RUN_IDS.initiativeId}&session_id=${BROWSER_E2E_BLOCKED_RUN_IDS.sessionId}`,
    batchHref: `/execution/batches/${BROWSER_E2E_BLOCKED_RUN_IDS.batchId}?initiative_id=${BROWSER_E2E_BLOCKED_RUN_IDS.initiativeId}&task_graph_id=${BROWSER_E2E_BLOCKED_RUN_IDS.taskGraphId}&session_id=${BROWSER_E2E_BLOCKED_RUN_IDS.sessionId}`,
    deliveryHref: null,
  },
} satisfies InitiativeContinuityResponse;
