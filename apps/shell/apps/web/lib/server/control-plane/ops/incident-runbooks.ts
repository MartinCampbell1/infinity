export type IncidentRunbookId =
  | "kernel-down"
  | "db-down"
  | "delivery-stuck"
  | "auth-failure";

export type IncidentAlertId =
  | "execution_kernel_down"
  | "control_plane_db_down"
  | "delivery_stuck"
  | "control_plane_auth_failure";

type IncidentRunbook = {
  id: IncidentRunbookId;
  title: string;
  scenario: string;
  anchor: string;
  owner: "runtime-ops" | "platform-ops" | "delivery-ops" | "security-ops";
  severity: "page" | "ticket";
  signals: string[];
};

type IncidentAlert = {
  id: IncidentAlertId;
  title: string;
  severity: "critical" | "warning";
  condition: string;
  runbookId: IncidentRunbookId;
  runbookPath: string;
  owner: IncidentRunbook["owner"];
};

export const INCIDENT_RUNBOOK_DOC_PATH = "docs/ops/incident-runbooks.md";

const REQUIRED_RUNBOOK_IDS: IncidentRunbookId[] = [
  "kernel-down",
  "db-down",
  "delivery-stuck",
  "auth-failure",
];

export const INCIDENT_RUNBOOKS: readonly IncidentRunbook[] = [
  {
    id: "kernel-down",
    title: "Kernel down",
    scenario: "Execution kernel healthz is unavailable or returning an unusable runtime state.",
    anchor: "kernel-down",
    owner: "runtime-ops",
    severity: "page",
    signals: [
      "GET /healthz fails from the shell runtime",
      "batch creation returns 502/503 or a kernel transport error",
      "execution issues page synthesizes runtime-kernel-health",
    ],
  },
  {
    id: "db-down",
    title: "DB down",
    scenario: "Control-plane Postgres cannot be reached or schema status cannot be read.",
    anchor: "db-down",
    owner: "platform-ops",
    severity: "page",
    signals: [
      "boot diagnostics reports controlPlaneSchema.observed.ready=false",
      "storagePolicy.postgresRequired=true and readOnly=true",
      "control-plane mutations fail before durable state is written",
    ],
  },
  {
    id: "delivery-stuck",
    title: "Delivery stuck",
    scenario: "A strict delivery remains non-ready, stale, or blocked after verification.",
    anchor: "delivery-stuck",
    owner: "delivery-ops",
    severity: "ticket",
    signals: [
      "delivery state remains blocked or stale after verification",
      "preview target health is failed or pending past the expected window",
      "signed manifest or external delivery preflight is missing",
    ],
  },
  {
    id: "auth-failure",
    title: "Auth failure",
    scenario: "Privileged control-plane or embedded workspace auth rejects valid operator flow.",
    anchor: "auth-failure",
    owner: "security-ops",
    severity: "page",
    signals: [
      "privileged API returns 401 or 403 for a configured actor",
      "workspace launch/bootstrap/session exchange cannot mint session state",
      "boot diagnostics marks auth secrets or allowed origins missing",
    ],
  },
] as const;

function runbookPath(anchor: string) {
  return `${INCIDENT_RUNBOOK_DOC_PATH}#${anchor}`;
}

export const INCIDENT_ALERTS: readonly IncidentAlert[] = [
  {
    id: "execution_kernel_down",
    title: "Execution kernel down",
    severity: "critical",
    condition: "Kernel health cannot be read or batch launch cannot reach the kernel.",
    runbookId: "kernel-down",
    runbookPath: runbookPath("kernel-down"),
    owner: "runtime-ops",
  },
  {
    id: "control_plane_db_down",
    title: "Control-plane DB down",
    severity: "critical",
    condition: "Postgres is required but schema status cannot be read or is not ready.",
    runbookId: "db-down",
    runbookPath: runbookPath("db-down"),
    owner: "platform-ops",
  },
  {
    id: "delivery_stuck",
    title: "Delivery stuck",
    severity: "warning",
    condition: "Strict delivery remains blocked, stale, or without downloadable signed artifacts.",
    runbookId: "delivery-stuck",
    runbookPath: runbookPath("delivery-stuck"),
    owner: "delivery-ops",
  },
  {
    id: "control_plane_auth_failure",
    title: "Control-plane auth failure",
    severity: "critical",
    condition: "Privileged API or workspace session exchange rejects configured operator/service auth.",
    runbookId: "auth-failure",
    runbookPath: runbookPath("auth-failure"),
    owner: "security-ops",
  },
] as const;

export function buildIncidentRunbookDiagnostics() {
  const runbookIds = new Set(INCIDENT_RUNBOOKS.map((runbook) => runbook.id));
  const alertRunbookIds = new Set(INCIDENT_ALERTS.map((alert) => alert.runbookId));
  const missingRunbooks = REQUIRED_RUNBOOK_IDS.filter((id) => !runbookIds.has(id));
  const missingAlertLinks = INCIDENT_ALERTS.filter(
    (alert) => !runbookIds.has(alert.runbookId) || !alert.runbookPath.includes(`#`),
  ).map((alert) => alert.id);
  const missingAlertCoverage = REQUIRED_RUNBOOK_IDS.filter(
    (id) => !alertRunbookIds.has(id),
  );

  return {
    ready:
      missingRunbooks.length === 0 &&
      missingAlertLinks.length === 0 &&
      missingAlertCoverage.length === 0,
    runbookDocPath: INCIDENT_RUNBOOK_DOC_PATH,
    requiredRunbooks: REQUIRED_RUNBOOK_IDS,
    runbooks: INCIDENT_RUNBOOKS.map((runbook) => ({
      id: runbook.id,
      title: runbook.title,
      scenario: runbook.scenario,
      owner: runbook.owner,
      severity: runbook.severity,
      runbookPath: runbookPath(runbook.anchor),
      signals: runbook.signals,
    })),
    alerts: INCIDENT_ALERTS,
    missingRunbooks,
    missingAlertLinks,
    missingAlertCoverage,
  };
}
