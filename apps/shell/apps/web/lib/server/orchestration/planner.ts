import type {
  InitiativeRecord,
  ProjectBriefRecord,
  TaskGraphEdge,
  TaskGraphRecord,
  WorkUnitRecord,
} from "../control-plane/contracts/orchestration";

import { nowIso, normalizeStringList } from "./shared";

type PlannedGraph = {
  taskGraph: TaskGraphRecord;
  workUnits: WorkUnitRecord[];
};

type PlannerWorkstream =
  | "topology_frontdoor"
  | "workspace_launch"
  | "control_plane_data"
  | "orchestration_flow"
  | "runtime_kernel"
  | "final_integration"
  | "qa_release_gate"
  | "shell_ui"
  | "work_ui";

type ScopeBuckets = {
  shell: string[];
  workUi: string[];
  services: string[];
  shared: string[];
};

function buildGraphId(initiativeId: string, briefId: string) {
  return `task-graph-${initiativeId}-${briefId}`;
}

function buildWorkUnitId(
  initiativeId: string,
  briefId: string,
  workstream: PlannerWorkstream
) {
  return `work-unit-${initiativeId}-${briefId}-${workstream}`;
}

function unique(values: readonly string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function toSearchHaystack(brief: ProjectBriefRecord) {
  return [
    brief.summary,
    ...brief.goals,
    ...brief.acceptanceCriteria,
    ...brief.deliverables,
    ...brief.repoScope,
  ]
    .join(" ")
    .toLowerCase();
}

function includesAny(haystack: string, needles: readonly string[]) {
  return needles.some((needle) => haystack.includes(needle));
}

function workUnitDepth(
  workUnit: WorkUnitRecord,
  byId: Map<string, WorkUnitRecord>,
  memo: Map<string, number>
): number {
  const cached = memo.get(workUnit.id);
  if (cached !== undefined) {
    return cached;
  }

  const depth: number =
    workUnit.dependencies.length === 0
      ? 0
      : 1 +
        Math.max(
          ...workUnit.dependencies.map((dependencyId) => {
            const dependency = byId.get(dependencyId);
            return dependency ? workUnitDepth(dependency, byId, memo) : 0;
          })
        );

  memo.set(workUnit.id, depth);
  return depth;
}

function criticalPathTitles(
  workUnit: WorkUnitRecord,
  byId: Map<string, WorkUnitRecord>,
  memo: Map<string, number>
): string[] {
  if (workUnit.dependencies.length === 0) {
    return [workUnit.title];
  }

  const deepestDependency = workUnit.dependencies
    .map((dependencyId) => byId.get(dependencyId))
    .filter((dependency): dependency is WorkUnitRecord => Boolean(dependency))
    .sort(
      (left, right) =>
        workUnitDepth(right, byId, memo) - workUnitDepth(left, byId, memo)
    )[0];

  if (!deepestDependency) {
    return [workUnit.title];
  }

  return [...criticalPathTitles(deepestDependency, byId, memo), workUnit.title];
}

export function deriveScopeBuckets(brief: ProjectBriefRecord): ScopeBuckets {
  const repoScope = unique(brief.repoScope);

  return {
    shell: repoScope.filter((scope) => scope.includes("apps/shell")),
    workUi: repoScope.filter((scope) => scope.includes("apps/work-ui")),
    services: repoScope.filter(
      (scope) => scope.includes("services/") || scope.includes("execution-kernel")
    ),
    shared: repoScope.filter(
      (scope) =>
        !scope.includes("apps/shell") &&
        !scope.includes("apps/work-ui") &&
        !scope.includes("services/")
    ),
  };
}

export function derivePlannerWorkstreams(brief: ProjectBriefRecord): PlannerWorkstream[] {
  const buckets = deriveScopeBuckets(brief);
  const haystack = toSearchHaystack(brief);
  const workstreams = new Set<PlannerWorkstream>([
    "topology_frontdoor",
    "workspace_launch",
    "control_plane_data",
    "orchestration_flow",
    "final_integration",
    "qa_release_gate",
  ]);

  if (
    buckets.services.length > 0 ||
    includesAny(haystack, ["kernel", "runtime", "restart", "durable", "batch"])
  ) {
    workstreams.add("runtime_kernel");
  }

  if (buckets.shell.length > 0 || includesAny(haystack, ["shell", "founderos", "control plane"])) {
    workstreams.add("shell_ui");
  }

  if (buckets.workUi.length > 0 || includesAny(haystack, ["workspace", "work-ui", "open webui", "embedded"])) {
    workstreams.add("work_ui");
  }

  return Array.from(workstreams);
}

export function buildPlannerNotes(workUnits: readonly WorkUnitRecord[]) {
  if (workUnits.length === 0) {
    return [] as string[];
  }

  const byId = new Map(workUnits.map((workUnit) => [workUnit.id, workUnit]));
  const memo = new Map<string, number>();
  const depths = new Map(
    workUnits.map((workUnit) => [workUnit.id, workUnitDepth(workUnit, byId, memo)])
  );
  const maxDepth = Math.max(...depths.values());
  const deepestUnit =
    workUnits
      .slice()
      .sort(
        (left, right) =>
          (depths.get(right.id) ?? 0) - (depths.get(left.id) ?? 0)
      )[0] ?? workUnits[0];
  const criticalPath = deepestUnit
    ? criticalPathTitles(deepestUnit, byId, memo).slice(-4)
    : [];
  const concurrencyGroups = Array.from(new Set(depths.values())).sort((left, right) => left - right);
  const riskFlags = [
    workUnits.some((workUnit) => workUnit.id.endsWith("runtime_kernel"))
      ? "runtime kernel dependency"
      : null,
    workUnits.some((workUnit) => workUnit.id.endsWith("work_ui")) &&
    workUnits.some((workUnit) => workUnit.id.endsWith("shell_ui"))
      ? "cross-shell workspace coordination"
      : null,
    workUnits.some((workUnit) => workUnit.estimatedComplexity === "large")
      ? "large workstream present"
      : null,
  ].filter((value): value is string => Boolean(value));

  return [
    `critical path depth: ${maxDepth}`,
    `critical path focus: ${criticalPath.join(" -> ")}`,
    `concurrency groups: ${concurrencyGroups.length}`,
    riskFlags.length > 0
      ? `risk flags: ${riskFlags.join(", ")}`
      : "risk flags: none",
  ];
}

function defaultScopePaths(buckets: ScopeBuckets, workstream: PlannerWorkstream) {
  switch (workstream) {
    case "topology_frontdoor":
      return unique([
        ...buckets.shell,
        ...buckets.workUi,
        ...buckets.shared,
      ]).slice(0, 4);
    case "workspace_launch":
      return unique([...buckets.shell, ...buckets.workUi]).slice(0, 4);
    case "control_plane_data":
      return unique([...buckets.shell, ...buckets.shared]).slice(0, 4);
    case "orchestration_flow":
      return unique([...buckets.shell, ...buckets.shared]).slice(0, 4);
    case "runtime_kernel":
      return unique([...buckets.services, ...buckets.shared]).slice(0, 4);
    case "final_integration":
      return unique([
        ...buckets.shell,
        ...buckets.workUi,
        ...buckets.services,
        ...buckets.shared,
      ]).slice(0, 6);
    case "shell_ui":
      return unique(buckets.shell).slice(0, 4);
    case "work_ui":
      return unique(buckets.workUi).slice(0, 4);
    case "qa_release_gate":
      return unique([
        ...buckets.shell,
        ...buckets.workUi,
        ...buckets.services,
        ...buckets.shared,
      ]).slice(0, 6);
  }
}

function workstreamAcceptanceCriteria(
  brief: ProjectBriefRecord,
  workstream: PlannerWorkstream
) {
  const acceptance = normalizeStringList(brief.acceptanceCriteria);
  const specific: Record<PlannerWorkstream, string[]> = {
    topology_frontdoor: [
      "Root shell entry resolves to a valid FounderOS route.",
      "Topology defaults are explicit and aligned with the live local runtime.",
    ],
    workspace_launch: [
      "Workspace launch/bootstrap/auth seam is host-driven and deterministic.",
      "Embedded workspace does not silently fall back to legacy standalone auth.",
    ],
    control_plane_data: [
      "Release-critical shell surfaces read durable control-plane truth.",
      "No operator-facing route depends on placeholder-only semantics.",
    ],
    orchestration_flow: [
      "Approved briefs and planner launch remain separate lifecycle actions.",
      "Assembly, verification, and delivery record explicit durable artifacts.",
    ],
    runtime_kernel: [
      "Execution kernel state survives restart and remains queryable over HTTP.",
    ],
    final_integration: [
      "The planned workstreams converge into one integrated product result before QA.",
      "Final integration explicitly checks cross-surface coherence across shell, workspace, and runtime.",
    ],
    qa_release_gate: [
      "Validation commands and targeted tests pass for the impacted slices.",
      "Residual blockers are explicit before delivery is created.",
    ],
    shell_ui: [
      "Shell control-plane routes preserve route scope and deep links.",
    ],
    work_ui: [
      "Workspace UI preserves Open WebUI identity while honoring embedded host context.",
    ],
  };

  return acceptance.length > 0 ? unique([...specific[workstream], ...acceptance]) : specific[workstream];
}

function buildWorkUnit(
  initiative: InitiativeRecord,
  brief: ProjectBriefRecord,
  workstream: PlannerWorkstream,
  buckets: ScopeBuckets,
  dependencies: string[]
): WorkUnitRecord {
  const occurredAt = nowIso();
  const graphId = buildGraphId(initiative.id, brief.id);
  const unitId = buildWorkUnitId(initiative.id, brief.id, workstream);

  const titleByWorkstream: Record<PlannerWorkstream, string> = {
    topology_frontdoor: `Stabilize frontdoor and topology for ${initiative.title}`,
    workspace_launch: `Wire shell-to-workspace launch for ${initiative.title}`,
    control_plane_data: `Clean shell control-plane truth for ${initiative.title}`,
    orchestration_flow: `Harden orchestration lifecycle for ${initiative.title}`,
    runtime_kernel: `Make runtime kernel durable for ${initiative.title}`,
    final_integration: `Synthesize final integration for ${initiative.title}`,
    qa_release_gate: `Run QA and release gates for ${initiative.title}`,
    shell_ui: `Align shell operator surfaces for ${initiative.title}`,
    work_ui: `Align workspace UX for ${initiative.title}`,
  };

  const descriptionByWorkstream: Record<PlannerWorkstream, string> = {
    topology_frontdoor:
      "Stabilize the entry route and topology assumptions before deeper execution work proceeds.",
    workspace_launch:
      "Harden bootstrap, launch-token, embedded auth, and host bridge behavior across shell and workspace.",
    control_plane_data:
      "Remove placeholder-only semantics from operator-critical shell routes and data seams.",
    orchestration_flow:
      "Keep brief approval, planner launch, assembly, verification, and delivery as explicit durable steps.",
    runtime_kernel:
      "Add restart-safe persistence to the execution kernel and keep handler reads honest across restarts.",
    final_integration:
      "Bring the active workstreams back together into one coherent product result before release validation.",
    qa_release_gate:
      "Run the targeted validation matrix required to call the release path honestly done.",
    shell_ui:
      "Preserve FounderOS shell semantics while exposing the control-plane surfaces needed by the approved brief.",
    work_ui:
      "Preserve Open WebUI workspace identity while finishing the embedded host-aware execution surface.",
  };

  return {
    id: unitId,
    taskGraphId: graphId,
    title: titleByWorkstream[workstream],
    description: descriptionByWorkstream[workstream],
    executorType: workstream === "runtime_kernel" ? "droid" : "codex",
    scopePaths:
      defaultScopePaths(buckets, workstream).length > 0
        ? defaultScopePaths(buckets, workstream)
        : ["/Users/martin/infinity"],
    dependencies,
    acceptanceCriteria: workstreamAcceptanceCriteria(brief, workstream),
    estimatedComplexity:
      workstream === "qa_release_gate" || workstream === "topology_frontdoor"
        ? "small"
        : workstream === "runtime_kernel" || workstream === "orchestration_flow"
          ? "large"
          : "medium",
    status: dependencies.length === 0 ? "ready" : "queued",
    latestAttemptId: null,
    createdAt: occurredAt,
    updatedAt: occurredAt,
  };
}

export function buildTaskGraphEdges(workUnits: readonly WorkUnitRecord[]): TaskGraphEdge[] {
  return workUnits.flatMap((workUnit) =>
    workUnit.dependencies.map((dependencyId) => ({
      from: dependencyId,
      to: workUnit.id,
      kind: "depends_on" as const,
    }))
  );
}

export function planTaskGraphFromBrief(
  initiative: InitiativeRecord,
  brief: ProjectBriefRecord
): PlannedGraph {
  const occurredAt = nowIso();
  const buckets = deriveScopeBuckets(brief);
  const workstreams = derivePlannerWorkstreams(brief);
  const graphId = buildGraphId(initiative.id, brief.id);

  const dependencyMap = new Map<PlannerWorkstream, PlannerWorkstream[]>([
    ["topology_frontdoor", []],
    ["workspace_launch", ["topology_frontdoor"]],
    ["control_plane_data", ["topology_frontdoor"]],
    ["orchestration_flow", ["control_plane_data"]],
    ["runtime_kernel", ["orchestration_flow"]],
    [
      "final_integration",
      workstreams.filter(
        (workstream) =>
          workstream !== "qa_release_gate" && workstream !== "final_integration"
      ),
    ],
    ["shell_ui", ["control_plane_data"]],
    ["work_ui", ["workspace_launch"]],
    ["qa_release_gate", ["final_integration"]],
  ]);

  const workUnits = workstreams.map((workstream) =>
    buildWorkUnit(
      initiative,
      brief,
      workstream,
      buckets,
      (dependencyMap.get(workstream) ?? [])
        .filter((dependency) => workstreams.includes(dependency))
        .map((dependency) => buildWorkUnitId(initiative.id, brief.id, dependency))
    )
  );

  return {
    taskGraph: {
      id: graphId,
      initiativeId: initiative.id,
      briefId: brief.id,
      version: 1,
      nodeIds: workUnits.map((unit) => unit.id),
      edges: buildTaskGraphEdges(workUnits),
      status: "ready",
      createdAt: occurredAt,
      updatedAt: occurredAt,
    },
    workUnits,
  };
}
