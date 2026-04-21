# ECC-style Orchestration Adaptation Plan

> **For Hermes:** use `subagent-driven-development` if we execute this later. Preserve the existing layered architecture; do not import foreign product structure blindly.

**Goal:** Reproduce the useful *behaviors* promoted by Everything Claude Code (specialist agents, lazy-loaded skills, slash-command workflows, security gates, continuity/memory, structured planning/review) inside Martin’s existing stack **without** breaking its current logic, repo boundaries, or UX ownership.

**Architecture stance:**
- **Infinity / FounderOS shell** remains the operator-facing control plane.
- **Work UI / Open WebUI adaptation** remains the main conversation + workspace surface.
- **Hermes** remains the behavioral layer: skills, planning discipline, memory routing, continuity, orchestration glue.
- **Multica** remains the execution kernel / native agent-work substrate.
- **Codex / Forge / Gemini / other runtimes** remain execution providers, not the product shell.
- **Knowledgebase + memory + session_search** replace opaque “continuous learning” plugins as the persistent learning layer.

**Non-goals:**
- Do **not** install ECC wholesale and let it redefine the stack.
- Do **not** create a third primary frontend.
- Do **not** duplicate sessions/projects/issues/accounts into a parallel model when native sources already exist.
- Do **not** turn Open WebUI into a dashboard shell.
- Do **not** let “learning” become hidden prompt accretion with no inspectable source of truth.

---

## Current anchors verified from local context

### Editable / active roots
- `/Users/martin/infinity` — unified control plane / product integration root
- `/Users/martin/multica-selfhost` — Multica runtime + native execution substrate

### Reference roots (preserve as references where project rules require)
- `/Users/martin/open-webui`
- `/Users/martin/hermes-ui-martin`
- `/Users/martin/FounderOS`

### Relevant project truth already documented
- `infinity/AGENTS.md`
- `infinity/latest-plan.md`
- `infinity/unified-control-plane-super-spec-v2-2026-04-10.md`
- `open-webui/AGENTS.md`
- `multica-selfhost/AGENTS.md`

---

## What to import from ECC vs what to translate natively

| ECC idea | Native equivalent for Martin’s stack | Where it belongs |
|---|---|---|
| Planner + specialist agents | Multica agents + Hermes profiles + delegate/subagent patterns | `multica-selfhost` + Hermes profiles + Infinity control plane |
| 156 lazy skills | Hermes skills, loaded only when relevant | `~/.hermes/skills/` + profile rules |
| Slash commands | Hermes wrappers / command palette actions / shell actions | Infinity shell + Hermes CLI wrappers |
| AgentShield | Dedicated stack audit for prompts, MCP, secrets, hooks, permissions | `infinity/scripts/` or `multica-selfhost/scripts/` |
| Continuous learning | Knowledgebase + memory + continuity-first launcher + session recall | `~/.hermes/profiles/continuity-first/` + KB |
| Predictable rules in CLAUDE.md | Repo-local AGENTS/CLAUDE rules + Hermes profile/system constraints | repo docs + profile config |
| Team-of-agents feel | Control-plane-managed roles with visible state, review, approvals, audits | Infinity shell + work-ui + Multica |

---

## Recommended target architecture

```text
User
  -> Infinity / FounderOS shell
      -> global command layer
      -> attention / approvals / recoveries / quota / review / audit
      -> launches workspace sessions
  -> Embedded Work UI (Open WebUI-style adaptation)
      -> chat / transcript / files / tools / approvals / workspace
      -> Hermes behavioral semantics
  -> Multica execution kernel
      -> planner / implementer / reviewer / debugger / security workers
      -> runtime scheduling / issue ownership / task execution
  -> Runtimes
      -> Codex / Forge / Gemini / Hermes worker profiles
  -> Persistent learning layer
      -> knowledgebase / memory / session_search / continuity-first prefill
```

### Critical preservation rule
Keep the stack **layered**:
- **Shell truth** = Infinity / FounderOS control-plane state and operator surfaces.
- **Workspace truth** = Open WebUI-style work surface with Hermes behavior.
- **Execution truth** = Multica runtimes / issue execution / agent work.
- **Continuity truth** = knowledgebase + generated boot context, not an opaque plugin blob.

---

## Phase-by-phase implementation

## Phase 0 — Audit and mapping only

**Objective:** map ECC capabilities onto existing layers before adding anything.

**Files / areas to inspect or update:**
- `/Users/martin/infinity/latest-plan.md`
- `/Users/martin/infinity/unified-control-plane-super-spec-v2-2026-04-10.md`
- `/Users/martin/infinity/AGENTS.md`
- `/Users/martin/multica-selfhost/AGENTS.md`
- `~/.hermes/profiles/continuity-first/` (or create if missing)

**Deliverable:** one capability matrix:
- which ECC behavior already exists,
- which is missing,
- which should live in Infinity,
- which should live in Multica,
- which should live in Hermes profile/skills,
- which should not be adopted at all.

**Acceptance criteria:** no code changes yet; a written capability map exists.

---

## Phase 1 — Canonical agent role model

**Objective:** introduce a small, explicit specialist-agent set without exploding into dozens of gimmick agents.

**Recommended initial roles (v1):**
- `planner`
- `implementer`
- `reviewer`
- `debugger`
- `security-reviewer`
- `release-verifier`

**Where to implement:**
- primary execution definitions in `multica-selfhost`
- role descriptions / invocation rules in Hermes skills and profiles
- operator visibility in Infinity

**Suggested code/document anchors:**
- `multica-selfhost/server/internal/handler/agent*.go`
- `multica-selfhost/server/internal/service/task.go`
- `multica-selfhost/apps/web/features/*` for agent visibility
- `~/.hermes/profiles/multica-supervisor/`
- `~/.hermes/profiles/multica-worker-hermes/`

**Design rule:** fewer high-signal roles beat 38 weakly differentiated roles.

**Acceptance criteria:** each role has:
- a single responsibility,
- clear invocation conditions,
- visible audit trail,
- no overlap with shell ownership.

---

## Phase 2 — Skills and command layer

**Objective:** reproduce ECC’s “one slash instead of a paragraph” benefit, but using Hermes-native skills and wrappers.

**Recommended command set (v1):**
- `/plan`
- `/tdd`
- `/review`
- `/debug`
- `/security-scan`
- `/quality-gate`
- `/handoff`
- `/resume-context`

**Implementation direction:**
- Hermes skills remain the source of procedural truth.
- Thin CLI wrappers or command-palette actions call those skills.
- Infinity shell may expose them as operator actions.
- Work UI may expose them contextually per session.

**Likely artifact locations:**
- `~/.hermes/skills/`
- `~/.local/bin/` wrappers
- `infinity/apps/shell/*` command palette / action menus
- `infinity/apps/work-ui/*` contextual session actions

**Acceptance criteria:** command surfaces trigger known workflows, not ad-hoc prompts.

---

## Phase 3 — Continuity / learning layer

**Objective:** achieve the useful part of ECC “continuous learning” without black-box session residue.

**Use this stack:**
- `knowledgebase` for durable project knowledge
- `memory` for stable preferences/corrections
- `session_search` for transcript recall only
- continuity-first launcher/profile for generated boot context

**Where to implement:**
- `~/.hermes/profiles/continuity-first/`
- `~/.hermes/profiles/continuity-first/scripts/refresh_boot_context.py`
- generated artifacts like:
  - `NOW_CONTEXT.generated.md`
  - `PROJECT_REGISTRY.generated.md`
  - `OPEN_THREADS.generated.md`
  - `DELTA_SINCE_LAST_BOOT.generated.md`

**Important rule:** learning must be inspectable and correctable.
No hidden “instinct” store should silently mutate agent behavior without traceability.

**Acceptance criteria:** the system can answer:
- what projects matter now,
- what changed since last boot,
- what is stuck,
- what is forgotten but strategically important.

---

## Phase 4 — AgentShield equivalent for Martin’s stack

**Objective:** build a native security/guardrail scan for the real stack.

**What it should scan:**
- `AGENTS.md`, `CLAUDE.md`, profile prompts, `SOUL.md`
- Hermes config / profile config
- MCP configs and dangerous server permissions
- hardcoded secrets in repo docs/configs
- overly broad hooks/scripts
- suspicious “install random marketplace prompt/skill” flows
- command wrappers that bypass intended boundaries

**Likely implementation roots:**
- `/Users/martin/infinity/scripts/agent-stack-audit.py`
- `/Users/martin/infinity/scripts/agent-stack-audit.test.ts` or equivalent verification
- optional supporting checks in `/Users/martin/multica-selfhost/scripts/`

**Output should report:**
- severity
- exact file and line or source
- why it matters
- fix recommendation
- safe autofix only where deterministic

**Acceptance criteria:** one bounded command can audit the local stack before rollout or CI.

---

## Phase 5 — Review / quality gates

**Objective:** make specialist work visible, reviewable, and hard to ship unverified.

**Recommended gate flow:**
1. planner defines task + success criteria
2. implementer produces change
3. reviewer checks spec compliance
4. security-reviewer runs targeted audit when relevant
5. release-verifier runs final targeted validation

**Where it belongs:**
- execution in Multica / Hermes
- visibility in Infinity control plane
- status signals in Work UI for the active session

**Acceptance criteria:** no “done” state without evidence.

---

## Phase 6 — UI integration without architectural drift

**Objective:** surface ECC-style power in the existing product, not by adding another app.

**Infinity / shell should show:**
- active specialist roles per run
- blocked / awaiting review / awaiting approval lanes
- recovery / retry / failover actions
- quality/security gate status
- audit trail of who/what made the decision

**Work UI should show:**
- richer transcript semantics
- clear tool / approval / review cards
- session-local command actions
- lightweight specialist activity summaries

**Do not do:**
- no generic dashboard-card explosion
- no new visual system that breaks FounderOS/Open WebUI ownership
- no raw CLI dump as UI

**Acceptance criteria:** the product still feels like one system with two modes, not three products glued together.

---

## Phase 7 — Rollout order (recommended)

1. **Continuity-first layer first**
   - because it improves everything else immediately
2. **Small specialist-agent set**
   - planner / reviewer / debugger / security first
3. **Command layer**
   - make repeatable workflows cheap to invoke
4. **Security audit**
   - before scaling skill/plugin count
5. **UI surfacing in Infinity + Work UI**
   - once backend semantics exist
6. **Only then expand role catalog**
   - based on real observed bottlenecks

---

## What should NOT be copied from ECC literally

- The exact plugin ecosystem / marketplace dependency model
- Huge agent counts for optics
- Marketplace-style skill sprawl without curation
- Black-box “learning” that cannot be inspected
- Any assumption that Claude-centric architecture is the product architecture

Martin’s stack already has a stronger architectural separation than ECC marketing material:
- control plane,
- workspace surface,
- execution substrate,
- continuity layer.

Preserve that advantage.

---

## Recommended final positioning

**Yes, the ECC model can be applied almost completely at the behavior level.**

But the right move is:
- **import the operating principles, not the foreign architecture.**

### Final formula
- **ECC-style behavior** = yes
- **ECC as installed product architecture** = no
- **Native implementation inside Infinity + Multica + Hermes continuity layer** = yes

---

## Short execution brief for the next coding step

If we execute this plan, the first concrete deliverable should be:

1. write a capability matrix (`ECC feature -> native destination -> keep/skip/defer`)
2. define the initial 6 canonical specialist roles
3. define the first 8 command workflows
4. scaffold the continuity-first generated boot context if not already active
5. create a first `agent-stack-audit` script spec

That gives the ECC benefits fast while preserving the existing logic and architecture.
