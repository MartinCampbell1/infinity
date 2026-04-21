# Nexus: Autonomous Multi-Agent Project Orchestration System

**Version:** 1.0  
**Date:** 2026-04-14  
**Author:** Claude Opus 4.6 for Martin  
**Status:** Master Spec + Implementation Plan  

---

# 1. Executive Summary

Nexus is a lightweight autonomous orchestration layer that connects Martin's existing AI tools (Hermes, Forge, Claude Code, Codex, and others) into a unified system for managing ~14+ projects in parallel. It is not a new product or a replacement for any existing tool. It is a coordination backbone.

**Core principle:** Each tool stays what it is. Nexus adds three things:
1. A **shared project registry** (git-tracked YAML/Markdown) that all agents can read and write
2. A **task queue** with priority, routing, and escalation rules
3. An **autonomous loop** powered by Hermes cron that runs 24/7

**Architecture in one sentence:** Hermes cron ticks every N minutes, reads the task queue, dispatches work to Forge/Claude/Codex via their CLIs, collects results, updates state, and escalates to Martin only when pre-defined gates are hit.

**What Nexus is NOT:**
- Not a rewrite of FounderOS or Infinity
- Not a web app or dashboard (MVP is file + CLI only)
- Not a framework — it's a set of conventions, scripts, and a cron loop
- Not dependent on any single cloud service

**MVP delivery:** 2-3 focused days of implementation. Forge builds it, Hermes orchestrates it.

---

# 2. What to Use: FounderOS / Infinity / From Scratch

## Analysis

### FounderOS: What It Has

| Component | Relevance | Take? |
|-----------|-----------|-------|
| `ExecutionBriefV2` contract (Pydantic) | Excellent brief/task schema | **Pattern only** — adapt to YAML |
| Approval gates with rollback | Good escalation model | **Pattern only** |
| `InitiativeLifecycleState` enum | Project state machine | **Directly reusable** |
| Quorum orchestrator (discovery, ranking, simulation) | Product feature, not meta-tool | **Skip** |
| Autopilot (loop_runner, dispatcher, stuck_detector) | Relevant patterns | **Pattern only** |
| Shell UI (40+ routes, Next.js) | Product UI, not meta-tool | **Skip** |
| `founderos_contracts/lifecycle.py` — `FounderMode` enum | Good mode concept | **Adapt** |

**Verdict:** FounderOS is a product for end users. Its Python FastAPI backends (Quorum + Autopilot) are too heavy for a personal dev orchestration system. **Take the contract patterns and state machine design. Leave everything else.**

### Infinity: What It Has

| Component | Relevance | Take? |
|-----------|-----------|-------|
| Normalized event layer | Excellent event schema | **Pattern only** |
| Durable control-plane state (Postgres) | Over-engineered for dev meta-tool | **Skip** |
| Session management, workspace bridge | Product feature | **Skip** |
| Approval workflows, audit trails | Good patterns | **Pattern only** |
| Monorepo structure (Turbo, workspaces) | Infrastructure | **Skip** |
| Fixture-based testing | Testing pattern | **Skip for MVP** |

**Verdict:** Infinity is the product being built. It should be MANAGED BY Nexus, not used as Nexus's foundation. **Take the normalized event pattern concept. Leave the product.**

### From Scratch: What's Needed

The meta-system needs to be:
- **Lightweight** — no Python FastAPI servers, no Postgres, no React UI
- **File-based** — git-trackable, readable by any agent
- **CLI-first** — invokable from Hermes, Forge, Claude, Codex, shell scripts
- **Autonomous** — runnable via Hermes cron without human
- **Simple** — maintainable by a vibe coder, not a DevOps team

## Decision

**Build a new, lightweight system from scratch.** Borrow:
- State machine from FounderOS `lifecycle.py`
- Brief format structure from `ExecutionBriefV2`
- Escalation pattern from FounderOS approval gates
- Event normalization concept from Infinity

Build as:
- A git repo (`~/nexus/`) with YAML state files
- A small set of shell/Python scripts for dispatch and monitoring
- Hermes cron jobs for autonomous operation
- CLI wrapper for manual interaction

---

# 3. Target Architecture

```
                                 +-----------------+
                                 |     Martin      |
                                 |   (Operator)    |
                                 +--------+--------+
                                          |
                          Natural language via Hermes chat
                          or CLI via `nexus` command
                                          |
                                 +--------v--------+
                                 |     Hermes      |
                                 |  (Orchestrator)  |
                                 |                 |
                                 | - Cron scheduler|
                                 | - Task creation |
                                 | - Escalation UI |
                                 | - Memory/KB     |
                                 | - Progress rpts |
                                 +--------+--------+
                                          |
                              Reads/writes task queue
                              Invokes agents via CLI
                                          |
                    +---------------------+---------------------+
                    |                     |                     |
           +--------v--------+  +--------v--------+  +--------v--------+
           |     Forge       |  |   Claude Code   |  |     Codex       |
           |  (Primary Exec) |  |  (Complex Exec) |  | (Parallel Exec) |
           |                 |  |                 |  |                 |
           | forge -p "..."  |  | claude -p "..." |  | codex "..."     |
           | forge -C <dir>  |  | claude --dir .. |  | LB across 43    |
           +--------+--------+  +--------+--------+  +--------+--------+
                    |                     |                     |
                    +---------------------+---------------------+
                                          |
                              Writes results to task files
                              Updates project state
                                          |
                                 +--------v--------+
                                 |   ~/nexus/      |
                                 |  (State Store)  |
                                 |                 |
                                 | projects/*.yaml |
                                 | queue/*.yaml    |
                                 | logs/*.md       |
                                 | reports/*.md    |
                                 +-----------------+
```

## Components

### 3.1 State Store (`~/nexus/`)

```
nexus/
├── nexus.yaml                  # Global configuration
├── agents.yaml                 # Agent definitions, capabilities, limits
├── resources.yaml              # API accounts, rate limits, spend tracking
├── projects/                   # Per-project state
│   ├── _registry.yaml          # Index of all projects
│   ├── infinity/
│   │   ├── manifest.yaml       # Project metadata, phase, priority
│   │   ├── backlog.yaml        # Pending tasks for this project
│   │   └── context.md          # Current project context for agents
│   ├── founderos/
│   │   └── ...
│   ├── triad/
│   │   └── ...
│   └── ... (14+ projects)
├── queue/                      # Active task lifecycle
│   ├── pending/                # Ready to execute
│   │   └── TASK-001.yaml
│   ├── active/                 # Currently being executed
│   │   └── TASK-002.yaml
│   ├── done/                   # Completed (kept 7 days)
│   │   └── TASK-003.yaml
│   └── escalated/              # Needs human decision
│       └── TASK-004.yaml
├── logs/                       # Execution logs
│   ├── 2026-04-14.md           # Daily log
│   └── ...
├── reports/                    # Generated reports
│   ├── daily/
│   ├── weekly/
│   └── morning-briefing.md     # Latest morning brief
├── templates/                  # Task templates
│   ├── implementation.yaml
│   ├── review.yaml
│   ├── bugfix.yaml
│   └── research.yaml
├── scripts/                    # Operational scripts
│   ├── nexus                   # Main CLI entry point
│   ├── dispatch.sh             # Agent dispatcher
│   ├── collect.sh              # Result collector
│   ├── tick.sh                 # Single orchestration cycle
│   ├── morning-brief.sh        # Morning report generator
│   └── night-guard.sh          # Autonomous loop wrapper
└── hermes-cron/                # Hermes cron job definitions
    ├── orchestrator-tick.yaml  # Main 10-min tick
    ├── morning-brief.yaml      # 08:00 daily brief
    └── night-guard.yaml        # Overnight watchdog
```

### 3.2 Project Registry Schema

```yaml
# projects/_registry.yaml
projects:
  - id: infinity
    name: "Infinity"
    repo: /Users/martin/infinity
    phase: in_progress        # State machine state
    priority: 1               # 1=highest
    category: product         # product | tool | experiment | learning
    primary_agent: forge      # Default executor
    last_activity: "2026-04-14T12:00:00Z"
    blocked: false
    blocker_reason: null
    
  - id: founderos
    name: "FounderOS"
    repo: /Users/martin/FounderOS
    phase: in_progress
    priority: 2
    category: product
    primary_agent: forge
    last_activity: "2026-04-13T10:00:00Z"
    blocked: false
    
  - id: triad
    name: "Triad"
    repo: /Users/martin/Documents/triad
    phase: spec
    priority: 5
    category: tool
    primary_agent: claude
    last_activity: "2026-04-11T12:00:00Z"
    blocked: false

  # ... (all 14+ projects)
```

### 3.3 Project Manifest Schema

```yaml
# projects/infinity/manifest.yaml
id: infinity
name: "Infinity Unified Control Plane"
repo: /Users/martin/infinity
branch: main

phase: in_progress
sub_phase: "operational rollout prep"  # Freeform current focus

priority: 1
category: product

# What this project IS (stable)
description: |
  Unified operator control plane combining FounderOS shell 
  and Open WebUI workspace. Control + Work modes with 
  normalized events, durable state, approval workflows.

# Where it's AT (updated by agents)  
current_state: |
  14/14 implementation phases complete and verified.
  All tests green. Shell + Work-UI typecheck/build pass.
  Next: operational rollout, visual alignment, production auth.

# What BLOCKS it
blockers: []

# What's NEXT (ordered)
next_actions:
  - "Set up production deployment environment"
  - "Configure production auth with session issuance"
  - "Visual alignment pass against current upstream repos"
  - "Monitoring and telemetry integration"

# Key files an agent should read before touching this project
entry_points:
  - unified-control-plane-super-spec-v2-2026-04-10.md
  - latest-plan.md
  - contracts.md
  - agents.md

# Constraints agents must follow
constraints:
  - "Never edit files in references/ — read-only snapshots"
  - "Copy-then-adapt model for upstream code"
  - "Frozen contracts: no changes without contract-diff PR"
  - "Memory-constrained verification: NODE_OPTIONS='--max-old-space-size=1024'"

# Tags for routing
tags: [typescript, nextjs, svelte, postgres, monorepo]

# Metrics
estimated_completion: "2026-05-01"
total_tasks_completed: 47
total_tasks_remaining: 12
```

### 3.4 Task Schema

```yaml
# queue/pending/TASK-2026-0414-001.yaml
id: "TASK-2026-0414-001"
project: infinity
type: implementation          # implementation | review | bugfix | research | planning | refactor
priority: high                # critical | high | medium | low
title: "Set up production deployment environment"

description: |
  Configure the production deployment for Infinity.
  Set up environment variables, database connection,
  health checks, and deployment scripts.

# What the agent must read before starting
context_files:
  - /Users/martin/infinity/latest-plan.md
  - /Users/martin/infinity/contracts.md

# Acceptance criteria (machine-checkable where possible)
acceptance:
  - "npm run shell:build passes"
  - "npm run shell:test passes"
  - "Health check endpoint returns 200"
  - "All env vars documented in .env.example"

# Routing hints
preferred_agent: forge
fallback_agent: claude
required_capabilities: [implementation, devops]

# Execution constraints
max_duration_minutes: 120
requires_approval: false       # Pre-approved scope
allow_autonomous: true         # Can run in night mode
allow_git_push: false          # Needs human for push

# Dependencies
depends_on: []                 # Task IDs this waits on
blocks: ["TASK-2026-0414-002"] # Tasks that wait on this

# State tracking
status: pending                # pending | dispatched | active | done | failed | escalated
assigned_to: null
dispatched_at: null
started_at: null
completed_at: null
result: null                   # success | partial | failed
result_summary: null

# Escalation
escalation_rules:
  on_stuck_minutes: 30         # Escalate if no progress after 30 min
  on_failure: retry_once       # retry_once | escalate | skip
  max_retries: 1

# Audit
created_by: hermes
created_at: "2026-04-14T10:00:00Z"
updated_at: "2026-04-14T10:00:00Z"
```

---

# 4. Agent Roles and Hierarchy

```
                    +------------------+
                    |     Martin       |
                    |  (Supreme Auth)  |
                    +--------+---------+
                             |
                    Approvals, escalations,
                    priority overrides
                             |
                    +--------v---------+
                    |     Hermes       |         LEVEL 0: ORCHESTRATOR
                    | Chief of Staff   |
                    +--------+---------+
                             |
              +--------------+--------------+
              |              |              |
     +--------v------+ +----v-------+ +----v--------+
     |    Forge      | | Claude Code| |   Codex     |   LEVEL 1: EXECUTORS
     | Primary Exec  | | Complex    | | Parallel    |
     +--------+------+ +----+-------+ +----+--------+
              |              |              |
        (can invoke)   (has agents)   (LB across 43)
              |              |              |
     +--------v------+ +----v-------+ +----v--------+
     | Forge agents  | | CC agents  | | Codex pool  |   LEVEL 2: WORKERS
     | (if any)      | | reviewer   | | account #1  |
     +---------------+ | architect  | | account #2  |
                        | tdd-guide  | | ...         |
                        +------------+ | account #43 |
                                       +-------------+
```

## Role Definitions

### Hermes — Chief of Staff (Orchestrator)

**What it does:**
- Reads the task queue every tick (Hermes cron)
- Decides which tasks to dispatch and to which agent
- Creates new tasks from project backlogs
- Collects execution results
- Generates progress reports (morning brief, daily summary)
- Handles escalation communication with Martin
- Maintains long-term project memory via knowledgebase
- Provides the natural language interface for Martin

**What it does NOT do:**
- Write code directly
- Make irreversible decisions (deployments, pushes, data changes)
- Override Martin's explicit priorities
- Dispatch tasks outside pre-approved scopes in night mode

**Why Hermes:** See Section 7.

### Forge — Primary Executor

**What it does:**
- Executes implementation, debugging, and refactoring tasks
- Works non-interactively via `forge -p "<task>" -C <project-dir>`
- Writes code, runs tests, fixes issues
- Reports results by updating task YAML files
- Operates within semantic search workspace for context

**What it does NOT do:**
- Decide what to work on (Hermes decides)
- Push to git (unless explicitly approved)
- Communicate with Martin (Hermes does that)
- Work on tasks that require multi-repo coordination (Claude handles those)

**Invocation pattern:**
```bash
forge -p "$(cat queue/active/TASK-001.yaml | yq '.description')" \
  -C "$(cat queue/active/TASK-001.yaml | yq '.context_files[0]' | xargs dirname)"
```

### Claude Code — Complex Executor

**What it does:**
- Handles tasks that need deep reasoning, multi-file changes, or architecture work
- Uses its agent ecosystem (code-reviewer, architect, tdd-guide)
- Handles tasks tagged with `complex`, `architecture`, `multi-repo`
- Provides second-opinion reviews on Forge's output

**Invocation pattern:**
```bash
claude -p "$(cat queue/active/TASK-002.yaml | yq '.description')" \
  --directory "$(cat queue/active/TASK-002.yaml | yq '.project' | xargs nexus project-dir)"
```

### Codex — Parallel Executor

**What it does:**
- Handles quick, parallelizable tasks (code review, simple fixes, test writing)
- Load-balanced across 43 accounts via `codex-lb-pick-account`
- Best for tasks that can be done in <10 minutes
- Handles bulk operations (review 5 PRs, lint 3 repos, etc.)

**Invocation pattern:**
```bash
ACCOUNT=$(codex-lb-pick-account)
CODEX_AUTH=$ACCOUNT codex "$(cat queue/active/TASK-003.yaml | yq '.description')"
```

---

# 5. Control Loop: How the User Interacts

## 5.1 Primary Mode: Hermes Conversation

```
Martin:  "Что сегодня?"
Hermes:  Читает ~/nexus/reports/morning-briefing.md
         "Доброе утро. Вот картина на сейчас:

         АКТИВНЫЕ:
         1. Infinity [P1] — ожидает review auth integration (Forge завершил в 3:47)
         2. FounderOS [P2] — blocked: нужен API-ключ Linear
         3. Triad [P4] — idle, следующая задача: refactor coordinator

         ЭСКАЛАЦИИ (2):
         - TASK-041: Infinity deployment — нужно решение по хостингу
         - TASK-039: FounderOS — Codex нашёл потенциальную security issue в auth

         НОЧНОЙ ПРОГРЕСС:
         - Forge: 3 задачи выполнены, 1 partial
         - Codex: 7 code reviews, 2 test fixes
         - Общий расход: ~$4.20

         Рекомендую: сначала разблокировать эскалации, потом review auth."

Martin:  "Одобряю deployment на Vercel. Security issue покажи."
Hermes:  Обновляет TASK-041.yaml → status: done, result: approved
         Показывает TASK-039 детали из logs/
         "Вот что Codex нашёл: [детали]. Это критично?"

Martin:  "Нет, это false positive. Закрой."
Hermes:  Обновляет TASK-039.yaml → status: done, result: false_positive
         "Принял. Обе эскалации закрыты. Двигаю Infinity auth на review."
```

## 5.2 Secondary Mode: CLI

```bash
# Quick status
nexus status
# Output:
# PROJECT          PHASE          PRI  AGENT   LAST ACTIVITY     STATUS
# infinity         in_progress    1    forge   2h ago            3 tasks active
# founderos        in_progress    2    forge   12h ago           blocked
# triad            spec           5    claude  3d ago            idle
# ...

# Detailed project view
nexus status infinity
# Output: manifest.yaml content + active tasks + recent logs

# Queue management
nexus queue                    # Show all pending/active tasks
nexus queue add infinity \     # Create task manually
  --type implementation \
  --priority high \
  --title "Add monitoring" \
  --agent forge

# Escalation handling
nexus escalations              # Show pending human decisions
nexus approve TASK-041         # Approve a task
nexus reject TASK-039 "false positive"

# Autonomous mode
nexus night-mode start         # Enable overnight operation
nexus night-mode stop          # Disable
nexus night-mode status        # Check if running

# Reports
nexus report daily             # Generate/show daily report
nexus report weekly            # Weekly summary
nexus spend                    # Token/cost tracking
```

## 5.3 Passive Mode: Hermes Gateway (Optional, Phase 3+)

Hermes can push notifications via Telegram/WhatsApp:
- Morning brief at 8:00
- Critical escalation alerts
- Nightly progress summary at 23:00

---

# 6. Task Orchestration, Memory, Queues, Escalations

## 6.1 Task Lifecycle

```
                                    ┌──────────────────┐
                                    │    CREATED        │
                                    │ (in backlog.yaml) │
                                    └────────┬─────────┘
                                             │
                                    Scheduler picks it up
                                             │
                                    ┌────────v─────────┐
                                    │    PENDING        │
                                    │ (queue/pending/)  │
                                    └────────┬─────────┘
                                             │
                                    Dispatcher routes to agent
                                             │
                                    ┌────────v─────────┐
                                    │   DISPATCHED      │
                                    │ (queue/active/)   │
                                    └────────┬─────────┘
                                             │
                                    Agent starts working
                                             │
                                    ┌────────v─────────┐
                                    │    ACTIVE         │
                                    │ (agent executing) │
                                    └────────┬─────────┘
                                             │
                            ┌────────────────┼────────────────┐
                            │                │                │
                   ┌────────v──────┐ ┌───────v───────┐ ┌─────v────────┐
                   │    DONE       │ │   FAILED      │ │  ESCALATED   │
                   │ (queue/done/) │ │ (retry/esc.)  │ │ (queue/esc/) │
                   └───────────────┘ └───────────────┘ └──────────────┘
```

## 6.2 Scheduling Algorithm

```python
# Pseudocode: task prioritization
def prioritize_tasks(pending_tasks, projects):
    scored = []
    for task in pending_tasks:
        project = projects[task.project]
        
        # Base score from priority
        score = {"critical": 1000, "high": 100, "medium": 10, "low": 1}[task.priority]
        
        # Boost if project is high priority
        score += (10 - project.priority) * 50
        
        # Boost if task has dependents waiting
        score += len(task.blocks) * 30
        
        # Penalty if dependencies not met
        if any(dep.status != "done" for dep in task.depends_on):
            score = -1  # Skip
        
        # Penalty for blocked projects
        if project.blocked:
            score = -1  # Skip
        
        scored.append((score, task))
    
    return sorted(scored, key=lambda x: -x[0])
```

## 6.3 Dispatch Logic

```python
# Pseudocode: agent selection
def select_agent(task, available_agents):
    # 1. Check preferred agent
    if task.preferred_agent in available_agents:
        agent = available_agents[task.preferred_agent]
        if task.required_capabilities <= agent.capabilities:
            return agent
    
    # 2. Check fallback
    if task.fallback_agent in available_agents:
        agent = available_agents[task.fallback_agent]
        if task.required_capabilities <= agent.capabilities:
            return agent
    
    # 3. Best fit from capability matrix
    for agent in sorted(available_agents, key=lambda a: a.cost_tier):
        if task.required_capabilities <= agent.capabilities:
            if agent.current_load < agent.max_concurrent:
                return agent
    
    return None  # All agents busy; task stays pending
```

## 6.4 Autonomous Tick (The Main Loop)

This is the core function invoked by Hermes cron every 10 minutes:

```bash
#!/bin/bash
# scripts/tick.sh — Single orchestration cycle

NEXUS_DIR="$HOME/nexus"
LOG="$NEXUS_DIR/logs/$(date +%Y-%m-%d).md"

echo "## Tick $(date +%H:%M:%S)" >> "$LOG"

# 1. Collect results from active tasks
for task_file in "$NEXUS_DIR/queue/active/"*.yaml; do
    [ -f "$task_file" ] || continue
    task_id=$(yq '.id' "$task_file")
    agent=$(yq '.assigned_to' "$task_file")
    
    # Check if agent process is still running
    if ! is_agent_running "$task_id"; then
        result=$(collect_result "$task_id" "$agent")
        if [ "$result" = "success" ]; then
            mv "$task_file" "$NEXUS_DIR/queue/done/"
            echo "- DONE: $task_id" >> "$LOG"
        elif [ "$result" = "failed" ]; then
            retries=$(yq '.retries_left // 1' "$task_file")
            if [ "$retries" -gt 0 ]; then
                yq -i '.retries_left -= 1 | .status = "pending"' "$task_file"
                mv "$task_file" "$NEXUS_DIR/queue/pending/"
                echo "- RETRY: $task_id ($(($retries - 1)) left)" >> "$LOG"
            else
                yq -i '.status = "escalated"' "$task_file"
                mv "$task_file" "$NEXUS_DIR/queue/escalated/"
                echo "- ESCALATED: $task_id" >> "$LOG"
            fi
        fi
    else
        # Check for stuck
        started=$(yq '.started_at' "$task_file")
        max_min=$(yq '.max_duration_minutes' "$task_file")
        if is_stuck "$started" "$max_min"; then
            echo "- STUCK: $task_id (killing)" >> "$LOG"
            kill_agent "$task_id"
            yq -i '.status = "escalated" | .escalation_reason = "timeout"' "$task_file"
            mv "$task_file" "$NEXUS_DIR/queue/escalated/"
        fi
    fi
done

# 2. Dispatch pending tasks
for task_file in "$NEXUS_DIR/queue/pending/"*.yaml; do
    [ -f "$task_file" ] || continue
    
    # Check night mode restrictions
    if is_night_mode && ! yq -e '.allow_autonomous' "$task_file" > /dev/null 2>&1; then
        continue
    fi
    
    # Check dependencies
    if ! deps_satisfied "$task_file"; then
        continue
    fi
    
    # Select agent
    agent=$(select_agent "$task_file")
    if [ -z "$agent" ]; then
        continue  # No agent available
    fi
    
    # Dispatch
    dispatch "$task_file" "$agent"
    echo "- DISPATCHED: $(yq '.id' "$task_file") → $agent" >> "$LOG"
done

# 3. Generate tasks from project backlogs (if queue is thin)
pending_count=$(ls "$NEXUS_DIR/queue/pending/" 2>/dev/null | wc -l)
if [ "$pending_count" -lt 3 ]; then
    promote_from_backlogs >> "$LOG"
fi

echo "" >> "$LOG"
```

## 6.5 Dispatch Function

```bash
# scripts/dispatch.sh

dispatch() {
    local task_file="$1"
    local agent="$2"
    local task_id=$(yq '.id' "$task_file")
    local project=$(yq '.project' "$task_file")
    local description=$(yq '.description' "$task_file")
    local project_dir=$(yq ".projects[] | select(.id == \"$project\") | .repo" \
        "$NEXUS_DIR/projects/_registry.yaml")
    
    # Build context preamble
    local context=""
    for ctx_file in $(yq '.context_files[]' "$task_file" 2>/dev/null); do
        if [ -f "$ctx_file" ]; then
            context="$context\n---\nFile: $ctx_file\n$(head -100 "$ctx_file")\n"
        fi
    done
    
    # Build acceptance criteria
    local acceptance=$(yq '.acceptance[]' "$task_file" 2>/dev/null | sed 's/^/- /')
    
    # Build full prompt
    local prompt="TASK: $task_id
PROJECT: $project (directory: $project_dir)
TYPE: $(yq '.type' "$task_file")

DESCRIPTION:
$description

ACCEPTANCE CRITERIA:
$acceptance

CONSTRAINTS:
$(yq '.constraints[]' "$NEXUS_DIR/projects/$project/manifest.yaml" 2>/dev/null | sed 's/^/- /')

When done, create a file at $NEXUS_DIR/queue/active/${task_id}.result.md with:
- Status: success | partial | failed
- Summary of what was done
- Files changed
- Tests results
- Any issues or blockers found"

    # Update task state
    yq -i ".status = \"dispatched\" | .assigned_to = \"$agent\" | .dispatched_at = \"$(date -Iseconds)\"" \
        "$task_file"
    mv "$task_file" "$NEXUS_DIR/queue/active/"
    
    # Dispatch to agent
    case "$agent" in
        forge)
            nohup forge -p "$prompt" -C "$project_dir" \
                > "$NEXUS_DIR/logs/exec/${task_id}.log" 2>&1 &
            echo $! > "$NEXUS_DIR/queue/active/${task_id}.pid"
            ;;
        claude)
            nohup claude -p "$prompt" --directory "$project_dir" \
                > "$NEXUS_DIR/logs/exec/${task_id}.log" 2>&1 &
            echo $! > "$NEXUS_DIR/queue/active/${task_id}.pid"
            ;;
        codex)
            local account=$(codex-lb-pick-account)
            nohup env CODEX_AUTH="$account" codex "$prompt" \
                > "$NEXUS_DIR/logs/exec/${task_id}.log" 2>&1 &
            echo $! > "$NEXUS_DIR/queue/active/${task_id}.pid"
            ;;
    esac
}
```

## 6.6 Memory Architecture

```
+------------------+     +-------------------+     +------------------+
|  Hermes KB       |     |  Nexus State      |     |  Claude Memory   |
|  (Long-term)     |     |  (Operational)    |     |  (Session)       |
|                  |     |                   |     |                  |
| - Project hist.  |     | - projects/*.yaml |     | - .claude/memory |
| - Decisions      |     | - queue/*.yaml    |     | - Per-project    |
| - User prefs     |     | - logs/*.md       |     |   CLAUDE.md      |
| - Learnings      |     | - reports/*.md    |     |                  |
+------------------+     +-------------------+     +------------------+
        |                         |                        |
        |    Hermes reads/writes  |   All agents read      |  Claude reads
        |    via knowledgebase    |   via filesystem       |  per session
        +-------------------------+------------------------+
                                  |
                          Shared filesystem
                          (~/nexus/ git repo)
```

**Memory tiers:**

| Tier | Store | Scope | TTL | Who Writes |
|------|-------|-------|-----|------------|
| Operational | `~/nexus/` YAML/MD files | All agents | Current | All (via file writes) |
| Project Context | `projects/*/context.md` | Per project | Updated per phase | Hermes, executors |
| Long-term | Hermes knowledgebase | Cross-project | Permanent | Hermes only |
| Session | Claude `.claude/memory/` | Per Claude session | Session | Claude only |
| Execution | Forge `.forge.db` | Forge history | Permanent | Forge only |

**Rule:** Nexus state (`~/nexus/`) is the single source of truth for task state and project status. Agent-specific memories supplement but never override.

## 6.7 Escalation Rules

```yaml
# nexus.yaml — escalation configuration
escalation:
  # ALWAYS escalate — never auto-resolve
  always:
    - type: irreversible
      examples: ["git push", "database migration", "production deploy", "delete files"]
    - type: budget_exceeded
      threshold_usd: 10.00
      per: task
    - type: security
      examples: ["secrets found", "vulnerability detected", "auth bypass"]
    - type: architecture
      examples: ["new dependency > 5MB", "schema change", "API contract change"]
    - type: scope_creep
      trigger: "task touches > 10 files not in original scope"
  
  # ESCALATE after retry
  retry_then_escalate:
    - type: build_failure
      max_retries: 2
    - type: test_failure
      max_retries: 2
    - type: agent_stuck
      timeout_minutes: 30
    - type: agent_crash
      max_retries: 1
  
  # AUTO-RESOLVE — never bother Martin
  auto_resolve:
    - type: lint_errors
      action: "auto-fix and re-run"
    - type: formatting
      action: "auto-format"
    - type: simple_type_errors
      action: "fix and verify"
    - type: minor_dep_updates
      condition: "all tests pass after update"
  
  # Night mode — stricter rules
  night_mode:
    allow_only:
      - tasks with allow_autonomous: true
      - auto_resolve escalations
    block:
      - git push
      - new file creation outside project dirs
      - any external API calls
      - tasks with requires_approval: true
    on_any_escalation: "queue for morning, don't wake Martin"
```

---

# 7. Why Hermes as Orchestrator, Forge as Executor

## Hermes as Orchestrator

| Factor | Hermes | Forge | Claude | Codex |
|--------|--------|-------|--------|-------|
| Long-term memory | Knowledgebase + built-in MEMORY.md | .forge.db (semantic) | Session-limited | None |
| Session continuity | `--continue`, 900 turns, prefill | Conversation resume | Compaction limits | None |
| Scheduling | Native `hermes cron` | None | None | None |
| Gateway/notifications | Telegram, WhatsApp, webhooks | None | None | None |
| Natural conversation | Excellent, 14 personality modes | Basic | Good | Basic |
| Cost for orchestration | Medium (GPT-5.4 via Codex API) | Medium | High (Opus) | Low |
| Knows Martin's history | Yes (knowledgebase, wiki) | No | Partial (memory files) | No |
| Can invoke other tools | Yes (terminal, shell) | Yes | Yes | Yes |

**Hermes wins on:** memory depth, scheduling (native cron), notification channels, user relationship history, session continuity across 900 turns.

**The key advantage:** Hermes cron is a production-ready scheduling system. No other tool has native cron. Building cron from scratch would be reinventing what Hermes already has.

## Forge as Primary Executor

| Factor | Forge | Claude Code | Codex |
|--------|-------|-------------|-------|
| Non-interactive mode | `forge -p` | `claude -p` | `codex` |
| Semantic search | Built-in workspace | Grep/Glob | None |
| Speed | Fast | Medium | Fast |
| Cost | Medium | High (Opus) | Low |
| Code quality | High | Highest | Medium |
| Reliability | High (retries, backoff) | High | Medium |
| Max concurrent | 3 (practical) | 2 (practical) | 10+ (43 accounts) |
| File operations | Excellent | Excellent | Good |
| Project awareness | Workspace-based | CLAUDE.md + agents | Minimal |

**Forge wins on:** semantic search (finds relevant code faster), reliability (built-in retry/backoff), practical speed for implementation tasks, reasonable cost.

**When to use Claude instead:** Architecture decisions, multi-repo changes, complex reasoning, code review with deep analysis.

**When to use Codex instead:** Bulk parallel tasks, quick fixes, code review that doesn't need deep reasoning.

---

# 8. Where to Use Other Tools

## Tool Routing Matrix

| Tool | Use For | Don't Use For | Integration Method |
|------|---------|---------------|-------------------|
| **Hermes** | Orchestration, scheduling, memory, user comms, planning | Code execution (use executors) | Native cron + CLI |
| **Forge** | Implementation, debugging, refactoring, testing | Architecture decisions, user comms | `forge -p` CLI |
| **Claude Code** | Complex architecture, multi-file, deep review | Simple tasks, bulk ops | `claude -p` CLI |
| **Codex** | Bulk reviews, quick fixes, parallel tasks | Complex reasoning, long tasks | `codex` with LB |
| **PepperClip** | [needs clarification on capabilities] | — | TBD |
| **Multica** | Multi-agent coordination for single complex tasks | Simple tasks | When one task needs 3+ agents |
| **OpenCode** | TBD — evaluate if it adds value beyond existing | — | TBD |
| **Gemini** | Alternative perspective, second opinion on arch | Primary execution | `gemini-mcp-tool` |
| **IDR** | [not yet installed — evaluate] | — | TBD |
| **OpenHands** | [not yet installed — browser automation, UI testing] | — | TBD |
| **Aider** | [not yet installed — git-aware pair programming] | — | TBD |

## Practical Routing Rules

```yaml
# In nexus.yaml
routing:
  # Task type → preferred agent
  implementation: forge
  bugfix: forge
  refactor: forge
  testing: forge
  
  architecture: claude
  multi_repo: claude
  complex_review: claude
  
  quick_review: codex
  bulk_lint: codex
  simple_fix: codex
  
  planning: hermes
  research: hermes
  communication: hermes
  
  # Capability-based fallback
  fallback_chain:
    - forge       # Try first (best cost/quality ratio)
    - claude      # If Forge can't handle complexity
    - codex       # If others are busy (parallel capacity)
```

## Account/Token Management

```yaml
# resources.yaml
resources:
  hermes:
    provider: openai-codex
    model: gpt-5.4
    billing: chatgpt-plus  # Included in subscription
    rate_limit: "varies"
    monthly_budget: null    # Unlimited with subscription
    
  forge:
    provider: forge-api
    model: proprietary
    billing: forge-subscription
    rate_limit: "100 req/min"
    monthly_budget: null
    
  claude:
    provider: anthropic
    model: claude-opus-4-6
    billing: claude-subscription
    rate_limit: "per plan"
    monthly_budget: "$50"
    
  codex:
    provider: openai-codex
    model: gpt-5.4
    billing: chatgpt-plus-pool  # 43 accounts
    accounts: 43
    load_balancer: codex-lb-pick-account
    rate_limit_per_account: "varies"
    monthly_budget: null    # Included in subscriptions
    strategy: least_used
    
  gemini:
    provider: google
    model: gemini-2.5-pro
    billing: google-ai
    rate_limit: "varies"
    monthly_budget: "$20"

spend_tracking:
  enabled: true
  log_file: "logs/spend.yaml"
  alert_threshold_daily: 15.00
  alert_threshold_monthly: 200.00
```

---

# 9. MVP Foundation

## What MVP Includes (Phase 0 + Phase 1)

1. **Git repo `~/nexus/`** with directory structure
2. **Project registry** with all 14+ projects seeded
3. **Task queue** (file-based YAML)
4. **`nexus` CLI script** for basic operations (status, queue, approve)
5. **`dispatch.sh`** that can invoke Forge and Claude
6. **`tick.sh`** — single orchestration cycle
7. **One Hermes cron job** running tick every 10 minutes
8. **Morning brief generator**

## What MVP Excludes (Deferred)

- Night mode autonomous operation (Phase 2)
- Codex load balancing integration (Phase 2)
- Telegram/WhatsApp notifications (Phase 3)
- Spend tracking (Phase 3)
- Web dashboard (Phase 4+)
- Multica/OpenHands/Aider integration (Phase 4+)

## MVP File Structure (Minimal)

```
nexus/
├── nexus.yaml                  # Config
├── agents.yaml                 # Agent definitions
├── projects/
│   ├── _registry.yaml          # All projects
│   └── infinity/
│       └── manifest.yaml       # One project to start
├── queue/
│   ├── pending/
│   ├── active/
│   ├── done/
│   └── escalated/
├── logs/
│   └── exec/                   # Execution output
├── reports/
├── scripts/
│   ├── nexus                   # CLI entry point (bash)
│   ├── dispatch.sh
│   ├── collect.sh
│   ├── tick.sh
│   └── morning-brief.sh
└── README.md
```

## MVP Bootstrap (Exact Steps)

```bash
# 1. Create repo
mkdir -p ~/nexus
cd ~/nexus
git init

# 2. Create structure
mkdir -p projects queue/{pending,active,done,escalated} \
         logs/exec reports/{daily,weekly} scripts

# 3. Seed config files (Forge/Claude will generate content)

# 4. Seed project registry from filesystem scan

# 5. Create CLI scripts

# 6. Register Hermes cron job
hermes cron create --name "nexus-tick" \
  --schedule "*/10 * * * *" \
  --command "bash ~/nexus/scripts/tick.sh"

# 7. Test one manual dispatch cycle
nexus queue add infinity --type implementation --priority high \
  --title "Test task" --agent forge
nexus tick  # Run one cycle
nexus status  # Verify
```

---

# 10. Phased Implementation Plan

## Phase 0: Scaffold (Day 1, ~2 hours)

**Who executes:** Forge (dispatched by Martin via Claude or Hermes)

**Deliverables:**
- [ ] Create `~/nexus/` git repo
- [ ] Create directory structure
- [ ] Write `nexus.yaml` with config schema
- [ ] Write `agents.yaml` with Hermes/Forge/Claude/Codex definitions
- [ ] Write `projects/_registry.yaml` with all discovered projects
- [ ] Create manifest.yaml for top 5 priority projects
- [ ] Create `scripts/nexus` CLI skeleton (bash)
- [ ] `git init && git add -A && git commit`

**Acceptance:**
- Directory structure matches spec
- All YAML files parse correctly (`yq . <file>`)
- `nexus status` prints project list

## Phase 1: Core Dispatch (Day 1-2, ~4 hours)

**Who executes:** Forge

**Deliverables:**
- [ ] Implement `scripts/dispatch.sh` — invoke Forge and Claude via CLI
- [ ] Implement `scripts/collect.sh` — read `.result.md` files and update task status
- [ ] Implement `scripts/tick.sh` — full orchestration cycle
- [ ] Implement `nexus queue add` command
- [ ] Implement `nexus queue list` command
- [ ] Implement `nexus approve <task-id>` command
- [ ] Create task templates in `templates/`
- [ ] Test: create a task, dispatch to Forge, collect result

**Acceptance:**
- `nexus queue add` creates valid YAML in `queue/pending/`
- `nexus tick` moves a task from pending → active → done
- Forge successfully executes a test task and writes result
- Logs captured in `logs/exec/`

## Phase 2: Hermes Integration + Night Mode (Day 2-3, ~6 hours)

**Who executes:** Forge + manual Hermes cron setup

**Deliverables:**
- [ ] Register `nexus-tick` Hermes cron job (10-minute interval)
- [ ] Register `nexus-morning-brief` cron job (daily 08:00)
- [ ] Implement `scripts/morning-brief.sh`
- [ ] Implement night mode toggle (`nexus night-mode start/stop`)
- [ ] Add night mode restrictions to `tick.sh`
- [ ] Add stuck detection (timeout-based)
- [ ] Add escalation file creation
- [ ] Implement `nexus escalations` command
- [ ] Test: let system run autonomously for 1 hour with 3 test tasks
- [ ] Hermes knowledgebase entry: Nexus operating manual

**Acceptance:**
- Hermes cron runs `tick.sh` every 10 minutes
- Morning brief generated and readable
- Night mode blocks non-approved tasks
- Stuck tasks escalated after timeout
- `nexus escalations` shows pending human decisions

## Phase 3: Codex LB + Spend Tracking + Notifications (Day 3-4, ~4 hours)

**Who executes:** Forge

**Deliverables:**
- [ ] Integrate `codex-lb-pick-account` into dispatch
- [ ] Add Codex as parallel executor in routing
- [ ] Implement spend tracking in `logs/spend.yaml`
- [ ] Add daily spend alerts
- [ ] Configure Hermes gateway for Telegram notifications (if desired)
- [ ] Implement weekly report generator
- [ ] Test: dispatch 5 parallel tasks to Codex pool

**Acceptance:**
- Codex tasks routed through load balancer
- Spend logged per task
- Alert generated when daily threshold exceeded
- 5 parallel Codex tasks complete successfully

## Phase 4: Multi-Project Autonomy (Day 4-5, ~6 hours)

**Who executes:** Forge + Claude (for complex parts)

**Deliverables:**
- [ ] Implement backlog → pending promotion logic
- [ ] Add project priority rebalancing
- [ ] Add cross-project dependency tracking
- [ ] Implement `nexus rebalance` — re-prioritize based on progress
- [ ] Add project phase transition logic (auto-advance when criteria met)
- [ ] Seed backlogs for all 14 projects from their current state
- [ ] 24-hour autonomous test run

**Acceptance:**
- System manages 5+ projects concurrently
- Tasks generated from backlogs automatically
- No false escalations in 24-hour test
- Projects advance phases when criteria met

## Phase 5: Full System (Week 2, ~8 hours)

**Who executes:** Forge + Claude

**Deliverables:**
- [ ] Resource monitoring dashboard (terminal-based, `nexus dashboard`)
- [ ] Historical analytics (tasks/day, success rate, cost/project)
- [ ] Agent performance tracking (speed, quality, cost per agent)
- [ ] Integrate Gemini as alternative reviewer
- [ ] Evaluate and integrate OpenHands for browser-based testing
- [ ] Evaluate and integrate Aider for git-aware pair programming
- [ ] Cross-session Hermes memory sync for project context
- [ ] Full documentation
- [ ] System self-test suite

**Acceptance:**
- Dashboard shows real-time system state
- Analytics show trends over 1+ week
- All integrated agents dispatch successfully
- Self-test passes

---

# 11. Master Spec (Technical Reference)

## 11.1 CLI Interface Specification

```
nexus — Autonomous Multi-Agent Project Orchestration

USAGE:
    nexus <command> [options]

COMMANDS:
    status [project]           Show system or project status
    queue                      List all tasks in queue
    queue add <project>        Create new task
      --type <type>            Task type (implementation|review|bugfix|research|planning|refactor)
      --priority <pri>         Priority (critical|high|medium|low)
      --title <title>          Task title
      --description <desc>     Task description (or read from stdin)
      --agent <agent>          Preferred agent (forge|claude|codex)
      --autonomous             Allow autonomous execution
      --no-push                Disallow git push
    queue remove <task-id>     Remove a pending task
    approve <task-id>          Approve an escalated task
    reject <task-id> [reason]  Reject an escalated task
    escalations                List pending escalations
    tick                       Run one orchestration cycle manually
    night-mode start|stop|status  Control autonomous operation
    report daily|weekly        Generate/show report
    spend [period]             Show spend tracking
    rebalance                  Re-prioritize projects
    dashboard                  Live terminal dashboard
    init                       Initialize nexus in a new directory
    doctor                     Check system health

ENVIRONMENT:
    NEXUS_DIR                  Override nexus directory (default: ~/nexus)
    NEXUS_LOG_LEVEL            Logging verbosity (debug|info|warn|error)
```

## 11.2 Configuration Schema

```yaml
# nexus.yaml
version: "1.0"

# Orchestrator settings
orchestrator:
  tick_interval_minutes: 10
  max_concurrent_tasks: 5
  max_tasks_per_project: 2
  queue_low_water_mark: 3    # Generate new tasks when queue < 3 pending
  
# Night mode settings
night_mode:
  enabled: false
  start_hour: 23             # 23:00
  end_hour: 8                # 08:00
  allow_autonomous_only: true
  block_git_push: true
  block_external_apis: true
  max_spend_per_night: 5.00  # USD

# Reporting
reporting:
  morning_brief_hour: 8
  daily_summary_hour: 22
  weekly_summary_day: sunday
  
# Escalation defaults
escalation:
  stuck_timeout_minutes: 30
  max_retries: 1
  
# Spend alerts
spend:
  daily_alert_threshold: 15.00
  monthly_alert_threshold: 200.00
  
# Notifications (Phase 3+)
notifications:
  enabled: false
  channels:
    - type: telegram
      critical_only: false
    - type: terminal
      always: true
```

## 11.3 Agent Adapter Interface

Each agent adapter must implement:

```bash
# adapters/<agent>.sh — Agent adapter interface

# Required functions:

# dispatch(task_file, project_dir) → pid
#   Start agent working on task. Return process ID.
dispatch() { ... }

# is_running(pid) → boolean
#   Check if agent process is still alive.
is_running() { ... }

# collect_result(task_id) → "success" | "partial" | "failed"  
#   Read .result.md file and determine outcome.
collect_result() { ... }

# kill_task(pid)
#   Terminate agent process gracefully.
kill_task() { ... }

# get_load() → integer
#   Current number of active tasks for this agent.
get_load() { ... }

# max_concurrent() → integer
#   Maximum parallel tasks this agent can handle.
max_concurrent() { ... }
```

## 11.4 Event Log Format

```markdown
# logs/2026-04-14.md

## Tick 08:00:12
- MORNING_BRIEF: Generated ~/nexus/reports/morning-briefing.md
- STATS: 3 pending, 2 active, 5 done today, 0 escalated

## Tick 08:10:05
- DISPATCHED: TASK-2026-0414-001 → forge (infinity: production auth)
- DISPATCHED: TASK-2026-0414-002 → codex (founderos: review PRD)
- SKIPPED: TASK-2026-0414-003 (depends on TASK-001)

## Tick 08:20:08
- ACTIVE: TASK-2026-0414-001 (forge, 10m elapsed)
- DONE: TASK-2026-0414-002 (codex, result: success, 8m)

## Tick 08:30:03
- DONE: TASK-2026-0414-001 (forge, result: success, 20m)
- DISPATCHED: TASK-2026-0414-003 → forge (infinity: monitoring setup)
- PROMOTED: TASK-2026-0414-004 from infinity backlog (visual alignment)
```

## 11.5 Result File Format

Executors write this after completing a task:

```markdown
# queue/active/TASK-2026-0414-001.result.md

## Status: success

## Summary
Implemented production auth token verification for Infinity shell.
Added JWT validation middleware, environment variable configuration,
and health check endpoint.

## Files Changed
- apps/shell/apps/web/lib/server/auth/verify.ts (NEW)
- apps/shell/apps/web/lib/server/auth/middleware.ts (NEW)
- apps/shell/apps/web/app/api/health/route.ts (MODIFIED)
- apps/shell/apps/web/.env.example (MODIFIED)

## Tests
- npm run shell:typecheck — PASS
- npm run shell:build — PASS
- npm run shell:test — PASS (12 new tests added)

## Issues Found
None.

## Git
- Branch: feature/production-auth
- Commits: 2 (not pushed)
```

---

# 12. Hermes Orchestrator Specification (TZ)

This section is the complete operating instruction for Hermes in its role as Nexus orchestrator. Feed this to Hermes as a knowledgebase article or session preamble.

---

## HERMES ORCHESTRATOR OPERATING MANUAL

### Identity

You are the Chief of Staff for Martin's multi-project development operation. Your name in this role is **Nexus Orchestrator** (running inside Hermes). You manage a portfolio of 14+ software projects, coordinating multiple AI execution agents.

### Core Responsibilities

1. **Scheduling:** Run the orchestration tick via Hermes cron every 10 minutes. Each tick reads the task queue, dispatches work, collects results, and updates state.

2. **Task Management:** Create, prioritize, and route tasks to the right executor agent (Forge, Claude Code, or Codex).

3. **Progress Tracking:** Maintain project manifests, update phases, track blockers, and generate reports.

4. **Escalation Handling:** When a task fails, gets stuck, or needs human input, create an escalation and notify Martin at the appropriate time (immediately for critical, next morning for non-critical).

5. **Memory:** Store important decisions, learnings, and project context in your knowledgebase for cross-session continuity.

6. **Reporting:** Generate morning briefs (08:00), daily summaries (22:00), and weekly reports (Sunday).

### What You Can Do Autonomously

- Dispatch pre-approved tasks to executor agents
- Retry failed tasks (up to configured max)
- Auto-resolve lint, formatting, and simple type errors
- Promote tasks from project backlogs when queue is thin
- Generate reports and update project state
- Update project phase when all criteria are met

### What You Must Escalate to Martin

- Any irreversible action (git push, deploy, data change)
- Budget exceeded ($10+ per single task)
- Security concerns
- Architecture changes
- Scope creep (task touches >10 unexpected files)
- After 2 failed retries
- After 30-minute stuck timeout

### Task Routing

```
implementation, bugfix, refactor, testing → Forge
architecture, complex_review, multi_repo  → Claude Code
quick_review, bulk_lint, simple_fix       → Codex
planning, research, communication         → You (Hermes)
```

### Night Mode Rules

When night mode is active (23:00 - 08:00):
- Only dispatch tasks with `allow_autonomous: true`
- Never git push
- Never create files outside project directories
- Never call external APIs
- On any escalation: queue for morning, do not notify Martin
- If total night spend exceeds $5, stop dispatching

### Daily Schedule

```
08:00  Generate morning brief. Summarize overnight progress, 
       list escalations, recommend today's priorities.
       
08:10+ Normal operation. Tick every 10 minutes.
       Dispatch tasks, collect results, update state.

22:00  Generate daily summary. Today's progress, 
       tomorrow's priorities, spend report.
       
23:00  Enter night mode (if enabled).
       Dispatch autonomous-safe tasks only.
       
03:00  Mid-night checkpoint. Generate overnight status.
       If any issues, queue for morning brief.
```

### Communication Style with Martin

- Start with status, not pleasantries
- Use bullet points, not paragraphs
- Quantify progress (3/7 tasks done, not "good progress")
- When escalating, present the decision clearly with options
- Never ask Martin to do something an agent can do
- Speak Russian (Martin's primary language for conversation)

### Project Priority Rules

1. Priority 1 projects always get dispatched first
2. A blocked project never consumes queue slots
3. If two tasks have equal priority, pick the one with more dependents
4. Never work on priority 5+ projects if priority 1-2 have pending tasks
5. Martin can override any priority via conversation

### State Files You Manage

```
~/nexus/nexus.yaml              # Read for config
~/nexus/agents.yaml             # Read for agent capabilities
~/nexus/projects/_registry.yaml # Read/write for project list
~/nexus/projects/*/manifest.yaml # Read/write for project state
~/nexus/projects/*/backlog.yaml  # Read for task generation
~/nexus/queue/pending/*.yaml     # Write new tasks, read for dispatch
~/nexus/queue/active/*.yaml      # Read for monitoring
~/nexus/queue/done/*.yaml        # Read for reporting
~/nexus/queue/escalated/*.yaml   # Write escalations
~/nexus/logs/*.md                # Write execution logs
~/nexus/reports/*.md             # Write reports
```

### Knowledgebase Articles to Maintain

- `nexus-operating-manual` — this document
- `nexus-project-registry` — overview of all projects with current status
- `nexus-decisions-log` — key decisions made and why
- `nexus-agent-performance` — which agents work best for which tasks
- `nexus-martin-preferences` — how Martin likes things done

### Error Recovery

If Hermes itself crashes or restarts:
1. Read `~/nexus/queue/active/` to find in-progress tasks
2. Check PIDs in `.pid` files — are processes still running?
3. For dead processes, read `.result.md` if exists, otherwise mark as failed
4. Resume normal tick cycle

If a tick fails:
1. Log the error in `logs/`
2. Try again on next cycle
3. If 3 consecutive tick failures, write escalation

### Metrics to Track

Per tick: tasks dispatched, tasks completed, tasks failed, tasks escalated
Per day: total tasks, success rate, avg duration, total spend, projects touched
Per week: project phase changes, velocity trend, top blockers

---

# 13. Operator Instructions (For Martin)

## Getting Started

### Day 0: Installation

```bash
# 1. Clone/create the nexus repo
# (Forge or Claude will build this for you)
mkdir ~/nexus && cd ~/nexus && git init

# 2. Have Forge scaffold the project
forge -p "Read /Users/martin/infinity/NEXUS-MASTER-SPEC.md sections 3, 9, and 10 Phase 0. \
Execute Phase 0: create directory structure, config files, project registry. \
Seed all projects found in /Users/martin/ that are development projects." \
-C ~/nexus

# 3. Register Hermes cron jobs
hermes cron create --name "nexus-tick" \
  --schedule "*/10 * * * *" \
  --command "bash ~/nexus/scripts/tick.sh"

hermes cron create --name "nexus-morning" \
  --schedule "0 8 * * *" \
  --command "bash ~/nexus/scripts/morning-brief.sh"

# 4. Feed Hermes the orchestrator spec
# Copy Section 12 into a Hermes knowledgebase article
hermes memory  # or manual knowledgebase update

# 5. Test
~/nexus/scripts/nexus status
~/nexus/scripts/nexus tick
```

### Day 1-2: Calibration

- Run the system in **manual mode** (no cron, just `nexus tick` manually)
- Create 3-5 test tasks for your highest priority project
- Watch Forge/Claude execute them
- Verify results meet quality bar
- Adjust configs based on what you see

### Day 3+: Autonomous

- Enable Hermes cron
- Enable night mode when ready: `nexus night-mode start`
- Check morning briefs each day
- Handle escalations
- Let the system run

## Daily Routine

```
MORNING (5 min):
  1. Open terminal
  2. "hermes" → "Что сегодня?" 
     OR: nexus status && nexus escalations
  3. Handle escalations (approve/reject)
  4. Adjust priorities if needed
  5. Done — system runs itself

MIDDAY (optional, 2 min):
  1. nexus status
  2. Check if anything is stuck
  3. Reprioritize if needed

EVENING (2 min):
  1. nexus report daily
  2. Enable night mode if desired
  3. Done
```

## How to Give Instructions

**Via Hermes (recommended):**
```
"Hermes, добавь задачу для Infinity: нужно сделать визуальное выравнивание 
 хедера с текущим FounderOS. Приоритет средний, пусть Forge сделает."
```

**Via CLI:**
```bash
nexus queue add infinity \
  --type refactor \
  --priority medium \
  --title "Visual alignment: header" \
  --description "Align shell header with current FounderOS reference" \
  --agent forge \
  --autonomous
```

**Via file (for complex tasks):**
Create `queue/pending/TASK-<date>-<seq>.yaml` manually with full task spec.

## How to Override

- **Stop everything:** `nexus night-mode stop` + `hermes cron pause nexus-tick`
- **Reprioritize:** Edit `projects/_registry.yaml` → change priority numbers
- **Block a project:** Set `blocked: true` in manifest
- **Force dispatch:** `nexus dispatch TASK-ID forge`
- **Kill a running task:** `kill $(cat queue/active/TASK-ID.pid)`

## What NOT to Do

- Don't edit files in `queue/active/` while an agent is working on them
- Don't delete `logs/` — the morning brief reads them
- Don't run `nexus tick` while Hermes cron is running (race condition)
- Don't give agents access to production credentials without review
- Don't set all projects to priority 1 — that defeats prioritization

---

# 14. Risks and Bottlenecks

## Critical Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Agent produces bad code silently | Corrupted project state | Acceptance criteria in every task; review tasks after implementation tasks |
| Hermes cron fails silently | System stops, Martin doesn't know | Health check in morning brief; Hermes cron status monitoring |
| Race condition: two agents edit same file | Merge conflicts, data loss | `max_tasks_per_project: 2` limit; never dispatch overlapping file scopes |
| Cost runaway | Unexpected spend on API calls | Per-task budget cap; daily/monthly alerts; night mode spend limit |
| State file corruption | Queue/registry breaks | Git-tracked state; can always `git checkout` to recover |
| Agent hallucination in task routing | Wrong agent gets wrong task | Capability checks in dispatch; fallback chain |

## Architecture Bottlenecks

| Bottleneck | Cause | Solution |
|------------|-------|----------|
| Sequential dispatch | `tick.sh` processes tasks one by one | Parallel dispatch with `&` for independent tasks |
| File-based queue | No atomic operations, possible races | Use `flock` for file locking; limit concurrent ticks to 1 |
| Agent startup time | Each Forge/Claude invocation has cold start | Batch small tasks; use Codex for sub-5-min work |
| Hermes cron granularity | Minimum 1-minute interval | 10-min tick is fine for project management; not for real-time |
| Context loss between agents | Agent B doesn't know what Agent A did | Handoff documents in task specs; shared `context.md` per project |

## Operational Risks

| Risk | Mitigation |
|------|------------|
| Martin forgets to check escalations | Morning brief highlights escalation count prominently |
| Too many projects, too few slots | Strict priority ranking; park low-priority projects |
| Agent changes break existing code | Mandatory test-pass acceptance criteria on every task |
| Night mode runs up costs | Hard spend cap per night ($5 default) |

---

# 15. What Needs Clarification

| Item | Question | Impact |
|------|----------|--------|
| **SDWG** | What does this acronym stand for? You mentioned it as an attention-scattering problem. | Understanding the root problem may change priority logic |
| **PepperClip** | What are its exact capabilities? CLI? API? What model? | Determines if it has a role in Nexus |
| **IDR** | What is this tool? You said you want to install it. | Might add value as an executor or reviewer |
| **Multica** | What are its current capabilities? Is it a coordinator or executor? | Could replace some Nexus orchestration logic |
| **OpenCode** | 20 config directories found — what do you use it for? | Might duplicate Forge/Claude capabilities |
| **Project list** | Are all 14+ projects still active/relevant? Which ones are definitively parked? | Affects registry seeding |
| **Hermes knowledgebase** | How much project history is already in there? Can I read it? | Might already have context Nexus needs |
| **Budget** | What's your comfortable monthly spend across all agents? | Sets hard limits in config |
| **Hosting** | Do you have a Mac running 24/7 for cron, or does Hermes cron run cloud-side? | Determines autonomous operation viability |
| **Microsoft Agent Framework** | See section below |

---

# 16. Secondary Tasks

## 16.1 Microsoft Agent Framework: Assessment

**Verdict: Not recommended for Nexus.**

| Factor | Assessment |
|--------|-----------|
| What it is | Enterprise framework for multi-agent orchestration (AutoGen, Semantic Kernel) |
| What it adds | Structured agent communication, tool use, conversation management |
| What it costs | Azure dependency, Python infrastructure, learning curve |
| For Martin | Massive over-engineering for a solo dev managing personal projects |
| Alternative | Nexus's file-based approach achieves 90% of the benefit at 10% complexity |

**When it WOULD make sense:** If Martin grows to a team of 5+ developers who all need to interact with the agent system, or if the system needs to handle 100+ concurrent tasks. For a solo founder with ~14 projects, file-based + shell scripts + Hermes cron is the right abstraction level.

## 16.2 Multi-Account Strategy

```
+-------------------+    +-------------------+    +-------------------+
| ChatGPT Plus x43  |    | Claude Pro        |    | Forge Sub         |
| (Codex accounts)  |    | (Claude Code)     |    | (Forge API)       |
+-------------------+    +-------------------+    +-------------------+
        |                         |                        |
   codex-lb-pick-account    Direct usage             Direct usage
        |                         |                        |
+-------v---------+       +------v--------+       +------v--------+
| Load Balancer   |       | Claude Code   |       | Forge CLI     |
| Round-robin or  |       | Primary for   |       | Primary for   |
| least-used      |       | architecture  |       | implementation|
+-----------------+       +---------------+       +---------------+

STRATEGY:
1. Bulk/parallel tasks → Codex pool (amortize across 43 accounts)
2. Complex single tasks → Claude (worth the cost)  
3. Standard implementation → Forge (best cost/quality)
4. Orchestration → Hermes (free with ChatGPT Plus)
5. Second opinion → Gemini (low cost, different perspective)

ANTI-CHAOS RULES:
- Each tool has ONE role in Nexus (no overlap without reason)
- codex-lb-pick-account already exists — Nexus uses it as-is
- Spend tracked per task, reported daily
- If monthly spend > threshold, auto-downgrade: Claude → Forge → Codex
```

## 16.3 Management Hierarchy Without Bureaucracy

```
CURRENT (what you need now):
    Martin
      └── Hermes (orchestrator)
            ├── Forge (primary executor)
            ├── Claude (complex executor)  
            └── Codex pool (bulk executor)

FUTURE (when project count > 20):
    Martin
      └── Hermes (chief orchestrator)
            ├── PM-Alpha (project cluster manager)
            │     ├── Forge instance 1
            │     └── Codex pool A
            ├── PM-Beta (project cluster manager)
            │     ├── Forge instance 2
            │     └── Codex pool B
            └── Claude (cross-cluster architecture)
```

**Don't add "project managers" yet.** With 14 projects and a 10-minute tick, one Hermes instance can manage everything. Add a PM layer only when:
- Tick takes >5 minutes to complete (too many tasks to evaluate)
- Projects need conflicting priorities within the same tick
- Martin wants different management styles for different project clusters

## 16.4 Autonomous Night Operations

```
23:00 — Night mode activates automatically (if enabled)
         Hermes cron continues ticking every 10 minutes
         
         ALLOWED:
         ✓ Tasks with allow_autonomous: true
         ✓ Implementation in existing branches
         ✓ Test running
         ✓ Code review (read-only analysis)
         ✓ Lint/format fixes
         ✓ Documentation generation
         
         BLOCKED:
         ✗ git push
         ✗ New branch creation
         ✗ File creation outside project dirs
         ✗ Database operations
         ✗ External API calls
         ✗ Anything with requires_approval: true
         ✗ Tasks on projects with blocked: true

00:00 — Midnight checkpoint
         Log: tasks completed, tasks remaining, spend so far
         
03:00 — Mid-night checkpoint  
         Same as midnight + check for stuck tasks
         
05:00 — Final night checkpoint
         Summarize night's work for morning brief
         
08:00 — Morning brief generated
         Night mode deactivates
         Hermes creates morning-briefing.md:
           - Tasks completed overnight
           - Tasks that failed/got stuck
           - Escalations pending
           - Recommended priorities for today
           - Overnight spend total
```

**Mandatory escalation points (even at night):**
- Task spends > $10 (kill the task, don't wake Martin)
- Total night spend > $5 (stop dispatching new tasks)
- Security finding (log it, escalate in morning)
- Agent process using > 4GB RAM (kill it)

## 16.5 Missing Components Assessment

| Component | Status | Actually Needed? | When? |
|-----------|--------|-------------------|-------|
| `yq` (YAML processor) | Likely not installed | **Yes — critical** for Nexus CLI | Phase 0 |
| `jq` (JSON processor) | Likely installed | Yes, for some adapters | Phase 0 |
| `flock` (file locking) | macOS has `flock` via brew | Yes, for race prevention | Phase 1 |
| Process supervisor | Not installed | **No** — Hermes cron is enough | — |
| Database (SQLite/Postgres) | Available but not needed | **No** — file-based is better | — |
| Web dashboard | Not built | Not for MVP | Phase 5+ |
| Browser automation | OpenHands not installed | For E2E testing only | Phase 5+ |
| Aider | Not installed | Evaluate — might complement Forge | Phase 4 |

**Install now:**
```bash
brew install yq jq
# That's it. No other infrastructure needed.
```

---

# Appendix A: Project Inventory (To Be Seeded)

Based on filesystem analysis, these are the projects to register:

| # | Project | Location | Category | Estimated Phase | Priority |
|---|---------|----------|----------|-----------------|----------|
| 1 | Infinity | ~/infinity | product | in_progress | 1 |
| 2 | FounderOS | ~/FounderOS | product | in_progress | 2 |
| 3 | Triad | ~/Documents/triad | tool | spec | 5 |
| 4 | MyMacAgent | ~/mymacagent | tool | idea | 6 |
| 5 | HermesMemory | ~/hermesmemory | tool | idea | 7 |
| 6 | Multica Self-Host | ~/multica-selfhost | tool | idea | 8 |
| 7 | Codex+Gemini | ~/codex-with-gemini-integration | tool | idea | 9 |
| 8 | Gemini MCP | ~/gemini-mcp-tool | tool | idea | 9 |
| 9 | ChatGPT Proxy | ~/chatgpt-proxy-recovered | tool | idea | 10 |
| 10 | Agentic Graph RAG | ~/agentic graph rag | experiment | idea | 10 |
| 11 | Free Code | ~/free-code | tool | idea | 10 |
| 12 | Solana Graph | ~/Desktop/solana-smart-money-graph | experiment | idea | 12 |
| 13 | DesignFigma | ~/Desktop/designfigma | tool | idea | 12 |
| 14 | Boat Calculator | ~/boatcalc2026 | product | idea | 14 |

[Нужно уточнение] — Martin should review this list and:
- Confirm priorities
- Add any missing projects
- Mark any as `sunset` (deprecated)
- Add descriptions and next actions for top 5

---

# Appendix B: Quick Reference Card

```
DAILY WORKFLOW:
  Morning:  hermes → "Что сегодня?" → handle escalations → go
  Midday:   nexus status (optional)
  Evening:  nexus report daily → nexus night-mode start

KEY COMMANDS:
  nexus status              — overview
  nexus queue               — task list
  nexus escalations         — pending decisions
  nexus approve TASK-ID     — approve escalation
  nexus tick                — manual cycle
  nexus night-mode start    — enable autonomous

ARCHITECTURE:
  Hermes  = brain (plans, schedules, reports, remembers)
  Forge   = hands (writes code, runs tests, fixes bugs)
  Claude  = architect (complex decisions, multi-file changes)
  Codex   = army (parallel bulk work across 43 accounts)

STATE LIVES IN:
  ~/nexus/projects/    — project state (manifest, backlog)
  ~/nexus/queue/       — task lifecycle (pending→active→done)
  ~/nexus/logs/        — execution history
  ~/nexus/reports/     — generated reports

ESCALATION = anything the system can't auto-resolve
NIGHT MODE = autonomous with safety rails
MORNING BRIEF = your daily 5-minute control surface
```

---

*End of Nexus Master Spec v1.0*
