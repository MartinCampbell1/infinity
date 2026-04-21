# Infinity Project Factory — Implementation-Ready Super-Spec

> Цель этого документа: дать агенту-программисту настолько точную инженерную инструкцию, чтобы он реализовал Infinity-native project factory без архитектурной самодеятельности и без путаницы между shell, work-ui, kernel и donor-репозиториями.

---

## 0. Как агент должен использовать эту спеку

1. Сначала прочитать документ целиком.
2. Ничего не реализовывать вне `/Users/martin/infinity`.
3. Идти **строго по фазам** ниже; не перепрыгивать через фазы.
4. Если задача требует правок в shell + work-ui + kernel одновременно, сначала разбить её на более мелкие пакеты.
5. Не менять архитектурные решения из этого документа без явной причины и без обновления спеки.
6. Донорные репозитории использовать только как reference-only sources.

---

## 1. Жёстко зафиксированные решения

### 1.1 Корневой продукт

Единственный root product:

- `/Users/martin/infinity`

Запрещено:

- создавать новый mega-repo рядом с Infinity;
- делать отдельный продукт-клон FounderOS;
- делать отдельный новый UI-продукт поверх Multica.

### 1.2 Текущий product split, который нельзя ломать

#### Shell

- путь: `/Users/martin/infinity/apps/shell/apps/web`
- стек: `Next.js 16 + React 19 + TypeScript`
- роль: operator-facing control plane, durable APIs, projections, boards, approvals, recoveries, audits

#### Work UI

- путь: `/Users/martin/infinity/apps/work-ui`
- стек: `SvelteKit + TypeScript`
- роль: Hermes-first workspace, intake UX, transcript/composer/files, project-run and result UX

#### Execution Kernel

- путь: `/Users/martin/infinity/services/execution-kernel`
- стек: `Go`
- роль: task execution runtime, attempts, batching, worker assignment, heartbeats, execution events

### 1.3 Donor hierarchy

#### Primary functional Hermes donor

- `/Users/martin/hermes-web-ui`

Использовать для:

- session grouping;
- tool-call detail surfaces;
- model/context visibility;
- file/skills/memory ergonomics;
- terminal/operator workspace behavior;
- BFF/SSE behavioral patterns.

#### Secondary donor

- `/Users/martin/open-webui`

Использовать для:

- workspace shell baseline;
- transcript/composer/files feel;
- embedded host mode;
- Hermes runtime/session bridge patterns.

#### Другие доноры

- `/Users/martin/FounderOS` — shell/operator grammar and route model
- `/Users/martin/multica-selfhost` — execution kernel/backend semantics
- `/Users/martin/hermesmemory` — continuity sidecar
- `CloudDocs` first-wave docs:
  - `FOUNDEROS-UNIFIED-SHELL-CONCEPT.md`
  - `HANDOFF_2026-04-10_control-plane_codex_ui_and_continuity.md`

### 1.4 Нельзя делать

- нельзя объявлять Open WebUI главной Hermes-оболочкой;
- нельзя редактировать `/Users/martin/open-webui`, `/Users/martin/hermes-web-ui`, `/Users/martin/FounderOS`;
- нельзя переносить execution-kernel код в shell UI папки;
- нельзя делать hidden magic state без durable contracts и audit trail.

---

## 2. Канонические implementation homes

### 2.1 Editable paths inside Infinity

- `/Users/martin/infinity/apps/shell`
- `/Users/martin/infinity/apps/work-ui`
- `/Users/martin/infinity/packages/api-clients`
- `/Users/martin/infinity/packages/config`
- `/Users/martin/infinity/packages/ui`
- `/Users/martin/infinity/packages/typescript-config`
- `/Users/martin/infinity/packages/eslint-config`
- `/Users/martin/infinity/services/execution-kernel` (создать)

### 2.2 Read-only references inside Infinity

- `/Users/martin/infinity/references/founderos`
- `/Users/martin/infinity/references/open-webui`
- `/Users/martin/infinity/references/hermes-webui`
- `/Users/martin/infinity/references/cabinet`

### 2.3 Existing anchors, которые нужно сохранять

#### Shell control-plane contracts

- `/Users/martin/infinity/apps/shell/apps/web/lib/server/control-plane/contracts/session-events.ts`
- `/Users/martin/infinity/apps/shell/apps/web/lib/server/control-plane/contracts/workspace-launch.ts`

#### Shell control-plane domains

- `/Users/martin/infinity/apps/shell/apps/web/lib/server/control-plane/accounts`
- `/Users/martin/infinity/apps/shell/apps/web/lib/server/control-plane/approvals`
- `/Users/martin/infinity/apps/shell/apps/web/lib/server/control-plane/audits`
- `/Users/martin/infinity/apps/shell/apps/web/lib/server/control-plane/events`
- `/Users/martin/infinity/apps/shell/apps/web/lib/server/control-plane/recoveries`
- `/Users/martin/infinity/apps/shell/apps/web/lib/server/control-plane/sessions`
- `/Users/martin/infinity/apps/shell/apps/web/lib/server/control-plane/state`
- `/Users/martin/infinity/apps/shell/apps/web/lib/server/control-plane/workspace`

#### Work-ui bridge anchors

- `/Users/martin/infinity/apps/work-ui/src/lib/founderos/index.ts`
- `/Users/martin/infinity/apps/work-ui/src/lib/utils/hermesSessions.ts`
- `/Users/martin/infinity/apps/work-ui/src/lib/utils/hermesTranscript.ts`

#### Existing API clients

- `/Users/martin/infinity/packages/api-clients/src/autopilot.ts`
- `/Users/martin/infinity/packages/api-clients/src/quorum.ts`
- `/Users/martin/infinity/packages/api-clients/src/runtime.ts`

---

## 3. Точная карта директорий и файлов, которые надо создать

## 3.1 Shell — новые server-side orchestration paths

Создать:

```text
apps/shell/apps/web/lib/server/control-plane/contracts/orchestration.ts

apps/shell/apps/web/lib/server/orchestration/
  initiatives.ts
  briefs.ts
  task-graphs.ts
  work-units.ts
  batches.ts
  supervisor.ts
  assembly.ts
  verification.ts
  delivery.ts
  projections.ts
```

## 3.2 Shell — новые API route groups

Создать:

```text
apps/shell/apps/web/app/api/control/orchestration/
  initiatives/
  briefs/
  task-graphs/
  work-units/
  batches/
  supervisor/
  assembly/
  verification/
  delivery/
```

Принцип:

- shell API — единственная durable orchestration API surface;
- work-ui не хранит orchestration truth локально.

## 3.3 Shell — новые operator-facing UI surfaces

Создать:

```text
apps/shell/apps/web/components/orchestration/
  initiative-workspace.tsx
  brief-workspace.tsx
  task-graph-board.tsx
  batch-board.tsx
  supervisor-queue.tsx
  assembly-workspace.tsx
  verification-workspace.tsx
  delivery-summary.tsx
```

## 3.4 Packages — shared API clients

Создать:

```text
packages/api-clients/src/multica.ts
packages/api-clients/src/multica-types.ts
packages/api-clients/src/orchestration.ts
```

Назначение:

- `multica.ts` — transport/client for execution-kernel endpoints
- `multica-types.ts` — typed models imported from kernel-facing contracts
- `orchestration.ts` — shell-owned orchestration API client consumed by work-ui and shell UI

## 3.5 Work UI — new orchestration modules

Создать:

```text
apps/work-ui/src/lib/orchestration/
  intake.ts
  brief-builder.ts
  planner-launch.ts
  batch-progress.ts
  result-handoff.ts

apps/work-ui/src/lib/apis/orchestration/
  initiatives.ts
  briefs.ts
  task-graphs.ts
  batches.ts
  verification.ts
  delivery.ts
```

## 3.6 Work UI — routes

Создать:

```text
apps/work-ui/src/routes/(app)/
  project-intake/
  project-brief/[id]/
  project-run/[id]/
  project-result/[id]/
```

## 3.7 Execution Kernel — new service root

Создать:

```text
services/execution-kernel/
  README.md
  cmd/
  internal/
    daemon/
    handler/
    service/
    realtime/
    events/
    logger/
    auth/
    middleware/
    supervisor/
  pkg/
    db/
    agent/
  migrations/
  scripts/
```

---

## 4. Actor matrix

| Actor | Где живёт | Основная ответственность | Что читает | Что пишет |
|---|---|---|---|---|
| User | work-ui | описывает проект, отвечает на clarifications, принимает результат | initiative/brief/result views | user request, approvals |
| Hermes | work-ui interaction layer | intake, clarification loop, user-facing continuity | initiative, brief, run progress, delivery | initiative updates, clarification answers, final user handoff |
| Droid-spec-writer | external agent actor | превращает user request в implementation-grade brief/spec | initiative context, answers, donor context | `ProjectBrief` |
| Planner | shell/kernal-adjacent planning service | превращает brief в DAG/task graph | brief | `TaskGraph`, `WorkUnit[]` |
| Orchestrator | shell-owned control-plane service | batching, concurrency limits, retry/reassign, escalation | task graph, attempts, worker capacity | batches, orchestration events, supervisor actions |
| Droid executor | execution worker | исполняет assigned work units | work unit payload, repo context | attempt artifacts, status updates |
| Codex executor | execution worker | исполняет assigned work units | work unit payload, repo context | attempt artifacts, status updates |
| Assembler | shell + kernel boundary actor | собирает outputs в coherent result | completed work units, artifacts | `Assembly` |
| Verifier | shell + validator layer | проверяет acceptance criteria и release-readiness | assembly, criteria | `VerificationRun` |
| Shell operator surface | Next.js shell | показывает правду control plane и даёт operator actions | all orchestration entities | approvals, recoveries, overrides |
| Go execution-kernel | service runtime | механика запуска work units, heartbeats, claim/release | batch instructions, work units | attempts, runtime events |

---

## 5. Канонические сущности и контракты

Все контракты должны жить в:

- `apps/shell/apps/web/lib/server/control-plane/contracts/orchestration.ts`

И экспортироваться в:

- `packages/api-clients/src/orchestration.ts`

## 5.1 Initiative

```ts
type InitiativeStatus =
  | "draft"
  | "clarifying"
  | "brief_ready"
  | "planning"
  | "running"
  | "assembly"
  | "verifying"
  | "ready"
  | "failed"
  | "cancelled";

interface InitiativeRecord {
  id: string;
  title: string;
  userRequest: string;
  status: InitiativeStatus;
  requestedBy: string;
  workspaceSessionId?: string | null;
  priority?: "low" | "normal" | "high";
  createdAt: string;
  updatedAt: string;
}
```

## 5.2 ProjectBrief

```ts
type ProjectBriefStatus =
  | "draft"
  | "clarifying"
  | "reviewing"
  | "approved"
  | "superseded";

interface ProjectBriefRecord {
  id: string;
  initiativeId: string;
  summary: string;
  goals: string[];
  nonGoals: string[];
  constraints: string[];
  assumptions: string[];
  acceptanceCriteria: string[];
  repoScope: string[];
  deliverables: string[];
  clarificationLog: { question: string; answer: string }[];
  status: ProjectBriefStatus;
  authoredBy: string;
  createdAt: string;
  updatedAt: string;
}
```

## 5.3 TaskGraph

```ts
type TaskGraphStatus = "draft" | "ready" | "active" | "completed" | "failed";

interface TaskGraphRecord {
  id: string;
  initiativeId: string;
  briefId: string;
  version: number;
  nodeIds: string[];
  edges: { from: string; to: string; kind: "depends_on" }[];
  status: TaskGraphStatus;
  createdAt: string;
  updatedAt: string;
}
```

## 5.4 WorkUnit

```ts
type WorkUnitExecutor = "droid" | "codex" | "human";
type WorkUnitStatus =
  | "queued"
  | "ready"
  | "dispatched"
  | "running"
  | "blocked"
  | "retryable"
  | "completed"
  | "failed"
  | "cancelled";

interface WorkUnitRecord {
  id: string;
  taskGraphId: string;
  title: string;
  description: string;
  executorType: WorkUnitExecutor;
  scopePaths: string[];
  dependencies: string[];
  acceptanceCriteria: string[];
  estimatedComplexity?: "small" | "medium" | "large";
  status: WorkUnitStatus;
  latestAttemptId?: string | null;
  createdAt: string;
  updatedAt: string;
}
```

## 5.5 Attempt

```ts
type AttemptStatus = "started" | "succeeded" | "failed" | "abandoned";

interface AttemptRecord {
  id: string;
  workUnitId: string;
  batchId?: string | null;
  executorType: WorkUnitExecutor;
  status: AttemptStatus;
  startedAt: string;
  finishedAt?: string | null;
  summary?: string | null;
  artifactUris: string[];
  errorCode?: string | null;
  errorSummary?: string | null;
}
```

## 5.6 ExecutionBatch

```ts
type ExecutionBatchStatus =
  | "queued"
  | "dispatching"
  | "running"
  | "blocked"
  | "completed"
  | "failed";

interface ExecutionBatchRecord {
  id: string;
  initiativeId: string;
  taskGraphId: string;
  workUnitIds: string[];
  concurrencyLimit: number;
  status: ExecutionBatchStatus;
  startedAt?: string | null;
  finishedAt?: string | null;
}
```

## 5.7 Assembly

```ts
type AssemblyStatus = "pending" | "assembling" | "assembled" | "failed";

interface AssemblyRecord {
  id: string;
  initiativeId: string;
  inputWorkUnitIds: string[];
  artifactUris: string[];
  outputLocation?: string | null;
  summary: string;
  status: AssemblyStatus;
  createdAt: string;
  updatedAt: string;
}
```

## 5.8 VerificationRun

```ts
type VerificationStatus = "pending" | "running" | "passed" | "failed";

interface VerificationCheck {
  name: string;
  status: "pending" | "passed" | "failed";
  details?: string | null;
}

interface VerificationRunRecord {
  id: string;
  initiativeId: string;
  assemblyId: string;
  checks: VerificationCheck[];
  overallStatus: VerificationStatus;
  startedAt?: string | null;
  finishedAt?: string | null;
}
```

## 5.9 Delivery

```ts
type DeliveryStatus = "pending" | "ready" | "delivered" | "rejected";

interface DeliveryRecord {
  id: string;
  initiativeId: string;
  verificationRunId: string;
  resultSummary: string;
  localOutputPath?: string | null;
  previewUrl?: string | null;
  command?: string | null;
  status: DeliveryStatus;
  deliveredAt?: string | null;
}
```

## 5.10 OrchestrationEvent

```ts
interface OrchestrationEventRecord {
  id: string;
  entityType:
    | "initiative"
    | "brief"
    | "task_graph"
    | "work_unit"
    | "attempt"
    | "batch"
    | "assembly"
    | "verification"
    | "delivery";
  entityId: string;
  kind: string;
  payload: Record<string, unknown>;
  createdAt: string;
}
```

---

## 6. State machines

## 6.1 Initiative

```text
draft
  -> clarifying
  -> brief_ready
  -> planning
  -> running
  -> assembly
  -> verifying
  -> ready

terminal:
  failed
  cancelled
```

Правила:

- `brief_ready` только после сохранённого approved brief;
- `running` только после созданного task graph;
- `ready` только после passed verification и созданного delivery.

## 6.2 ProjectBrief

```text
draft
  -> clarifying
  -> reviewing
  -> approved

alternate:
  -> superseded
```

Правила:

- `approved` обязателен перед planner;
- любой новый brief version помечает предыдущий как `superseded`.

## 6.3 TaskGraph

```text
draft -> ready -> active -> completed
                      \-> failed
```

Правила:

- `ready` только если у каждого work unit есть executor type, dependencies и acceptance criteria;
- `active` только после первого launched batch.

## 6.4 WorkUnit

```text
queued -> ready -> dispatched -> running -> completed
                           \-> blocked
                           \-> retryable -> dispatched
                           \-> failed
```

Правила:

- `ready` только если все dependencies completed;
- `retryable` выставляет orchestrator, не сам executor;
- `completed` только при наличии attempt с artifacts или explicit no-artifact completion note.

## 6.5 ExecutionBatch

```text
queued -> dispatching -> running -> completed
                           \-> blocked
                           \-> failed
```

Правила:

- batch не может стартовать с `concurrencyLimit <= 0`;
- batch считается `completed`, только если все work units в batch terminal и нет failed units без disposition.

## 6.6 Assembly

```text
pending -> assembling -> assembled
                     \-> failed
```

## 6.7 Verification

```text
pending -> running -> passed
                  \-> failed
```

Правило:

- failed verification блокирует delivery.

## 6.8 Delivery

```text
pending -> ready -> delivered
            \-> rejected
```

---

## 7. API map

## 7.1 Shell route groups

Агент должен реализовать минимум:

- `GET/POST /api/control/orchestration/initiatives`
- `GET/PATCH /api/control/orchestration/initiatives/[id]`
- `GET/POST /api/control/orchestration/briefs`
- `GET/PATCH /api/control/orchestration/briefs/[id]`
- `GET/POST /api/control/orchestration/task-graphs`
- `GET /api/control/orchestration/task-graphs/[id]`
- `GET/POST /api/control/orchestration/work-units`
- `GET/PATCH /api/control/orchestration/work-units/[id]`
- `GET/POST /api/control/orchestration/batches`
- `GET /api/control/orchestration/batches/[id]`
- `GET/POST /api/control/orchestration/supervisor/actions`
- `GET/POST /api/control/orchestration/assembly`
- `GET/POST /api/control/orchestration/verification`
- `GET/POST /api/control/orchestration/delivery`

## 7.2 Work-ui client modules

Work-ui не должен ходить напрямую в kernel. Он должен использовать shell-owned orchestration surface через:

- `src/lib/apis/orchestration/initiatives.ts`
- `src/lib/apis/orchestration/briefs.ts`
- `src/lib/apis/orchestration/task-graphs.ts`
- `src/lib/apis/orchestration/batches.ts`
- `src/lib/apis/orchestration/verification.ts`
- `src/lib/apis/orchestration/delivery.ts`

## 7.3 Execution-kernel surface

Kernel должен уметь:

- принять batch launch;
- выдать runnable work units;
- регистрировать claim/start/heartbeat/complete/fail;
- сохранить attempt artifacts;
- публиковать execution events;
- инициировать assembly/verification request hooks.

Kernel не должен:

- быть product truth owner;
- напрямую менять shell durable state без event/projection path.

---

## 8. Phased rollout

## Phase 0 — topology and contracts lock

### Сделать

- создать `orchestration.ts` contract file;
- создать этот super-spec и donor map references;
- зафиксировать API route families и entity model;
- не писать kernel logic до завершения contracts lock.

### Exit criteria

- у каждой сущности есть explicit contract;
- actor matrix понятен;
- directory plan не противоречит реальной структуре Infinity.

## Phase 1 — initiative + brief flow

### Сделать

- shell APIs for initiatives and briefs;
- work-ui `project-intake` and `project-brief/[id]`;
- `src/lib/orchestration/intake.ts`;
- `src/lib/orchestration/brief-builder.ts`;
- work-ui adapters to shell APIs.

### Exit criteria

- пользователь может создать initiative из work-ui;
- clarification loop сохраняется в brief;
- approved brief durable и виден в shell и work-ui.

## Phase 2 — planner + task graph

### Сделать

- planner service and graph creation path;
- shell APIs for task-graphs and work-units;
- shell UI for task-graph inspection;
- work-ui project-brief view показывает planning status.

### Exit criteria

- approved brief порождает valid DAG;
- каждый work unit имеет scope, dependencies, acceptance criteria, executor type;
- runnable nodes определяются детерминированно.

## Phase 3 — execution-kernel scaffold

### Сделать

- создать `services/execution-kernel`;
- импортировать first-wave kernel structure;
- создать `packages/api-clients/src/multica.ts` и `multica-types.ts`;
- связать shell orchestration layer с kernel client.

### Exit criteria

- kernel service поднимается;
- shell может создать batch и отправить его в kernel;
- attempt lifecycle доступен через typed client.

## Phase 4 — batch orchestration + supervisor

### Сделать

- orchestrator batching logic;
- bounded concurrency rules;
- retry/reassign policy;
- shell supervisor surfaces and actions;
- batch progress surface in work-ui.

### Exit criteria

- хотя бы один batch проходит `queued -> running -> completed`;
- retryable failure виден в shell;
- reassignment фиксируется auditably.

## Phase 5 — assembly + verification

### Сделать

- assembly service and shell endpoints;
- verification service and shell endpoints;
- work-ui `project-run/[id]` и `project-result/[id]`;
- failed verification blocks delivery.

### Exit criteria

- completed work units produce assembly;
- verifier produces check list with pass/fail;
- delivery не создаётся при failed verification.

## Phase 6 — delivery + localhost-ready handoff

### Сделать

- delivery entity and route;
- final Hermes/work-ui handoff surface;
- operator summary in shell;
- include `previewUrl`, `localOutputPath`, `command` when available.

### Exit criteria

- successful initiative ends with concrete delivery record;
- user sees ready-to-open local target;
- shell shows final audit trail end-to-end.

## Phase 7 — continuity + operator polish

### Сделать

- Hermes memory sidecar integration docs and adapters;
- approvals/recoveries integration with orchestration states;
- polished session/result linking between work-ui and shell.

### Exit criteria

- continuity is inspectable;
- no hidden prompt-only state needed to understand project lifecycle;
- operator can trace initiative from intake to delivery.

---

## 9. Непереговорные правила для programming agent

1. Не редактировать donor repos напрямую.
2. Не смешивать shell and work-ui responsibilities.
3. Не делать kernel source-of-truth owner.
4. Не хранить orchestration truth в browser-local state.
5. Все статусы и переходы должны быть explicit.
6. Все retries/reassignments/approvals/recoveries должны быть auditable.
7. Verifier failure всегда блокирует delivery.
8. `hermes-web-ui` — primary Hermes behavior donor; Open WebUI — secondary baseline donor.
9. Если задача слишком широкая, сначала разбить по фазам и слоям.
10. Финальный Definition of Done: пользователь получает рабочий local target (`localhost`, путь или команда), который можно открыть и проверить.

---

## 10. Валидация по ходу реализации

### Если менялся shell

```bash
npm --prefix "/Users/martin/infinity/apps/shell/apps/web" run lint
npm --prefix "/Users/martin/infinity/apps/shell/apps/web" run typecheck
npm --prefix "/Users/martin/infinity/apps/shell/apps/web" run test
```

### Если менялся work-ui

```bash
npm --prefix "/Users/martin/infinity/apps/work-ui" run check
npm --prefix "/Users/martin/infinity/apps/work-ui" run test:frontend
```

### Если менялись shared packages или обе стороны

```bash
npm --prefix "/Users/martin/infinity" run typecheck
npm --prefix "/Users/martin/infinity" run test
```

### Build policy

- build не гонять на каждом маленьком шаге;
- build запускать на milestone phase exit или перед delivery-related finish.

---

## 11. Финальный Definition of Done

Система считается реализованной правильно, когда:

1. пользователь пишет project request в work-ui;
2. Hermes/Droid clarification loop создаёт durable brief;
3. planner создаёт task graph;
4. orchestrator запускает bounded-concurrency batches;
5. Droid/Codex executors исполняют work units через kernel;
6. assembler собирает результат;
7. verifier подтверждает acceptance criteria;
8. delivery record содержит локально открываемый target;
9. shell показывает полный operator audit trail;
10. ни один из donor repos не был превращён во второй source of truth.
