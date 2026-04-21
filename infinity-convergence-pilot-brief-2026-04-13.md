# Infinity convergence product and pilot brief

Date: 2026-04-13
Context: response to Paperclip issue MARAAAA-4
Project root reviewed: `/Users/martin/infinity`
Primary source docs reviewed:
- `unified-control-plane-super-spec-v2-2026-04-10.md`
- `latest-plan.md`
- `AGENTS.md`
- `repo-map.md`

## Executive conclusion

Yes: Infinity should be treated as the primary sellable convergence surface.

But the product should not be positioned as “yet another AI chat app” or “another dashboard.” The strongest position is:

Infinity is the operator workspace for running many AI sessions, accounts, approvals, recoveries, and project work through one calm shell.

In practice that means:
- FounderOS contributes the operator shell and control mode.
- Open WebUI adaptation contributes the message-first work mode.
- Hermes contributes the behavior grammar for sessions, tool usage, approvals, retries, and workspace ergonomics.
- Codex/app-server/structured events provide the execution substrate.

The product thesis is not “combine three products.” It is “turn the best parts of those systems into one operator-grade surface with a clear split between control mode and work mode.”

## 1. Product thesis

### Core thesis

Infinity should become the sellable product because it has a sharper and more defensible promise than any of the individual ingredients:

A single product where an operator can launch, supervise, steer, recover, and continue AI work across many projects and many accounts without losing the quality of the actual chat/workspace experience.

### Why this is stronger than the parts

FounderOS alone is not enough because a shell without a first-class work surface feels like an admin console.

Open WebUI alone is not enough because a chat-first app does not solve multi-session fleet operations, quota pressure, recoveries, or cross-project visibility.

Hermes alone is not enough because it is the behavioral reference, not the product shell or durable control-plane truth.

Infinity can win because it makes the split explicit:
- control mode for fleet-level operations
- work mode for deep session execution
- one normalized control plane so both modes refer to the same session reality

### Sellable promise in one sentence

Infinity gives a small AI-native team one place to operate many agent sessions with the calmness of a premium chat workspace and the visibility of a real operator control plane.

## 2. Ideal customer profile

### Primary ICP

Small, high-agency teams of 1-10 operators who already run multiple AI sessions or agents across product, engineering, research, or trading workflows and are feeling pain from fragmentation.

Typical traits:
- founder-led or operator-led teams
- heavy daily AI usage
- multiple concurrent projects
- multiple accounts/models/providers to manage
- real need for approvals, retries, recoveries, and auditability
- dissatisfied with either pure chat UIs or generic monitoring dashboards

### Economic buyer

Usually the founder, technical operator, or head of product/engineering who personally feels the pain of context switching and broken supervision.

### User pain profile

They currently suffer from:
- too many disconnected sessions across tools
- weak visibility into what is running and what is blocked
- no durable recovery lane when agents fail or stall
- poor account/quota awareness during active work
- losing the quality of the actual workspace when moving into ops tooling

### Secondary ICP

Solo power users running an “AI company of one” who need:
- multiple live workstreams
- recoverable sessions
- account capacity awareness
- a shell that feels operational rather than toy-like

## 3. Most compelling end-to-end scenario

### Scenario: operator running a product launch week with multiple agent streams

A founder/operator is managing a launch across product, engineering, content, and research.

They open Infinity and land in control mode.

From the shell they can:
- see active sessions grouped by project
- spot blocked approvals and failing runs
- see which accounts are capacity-constrained
- detect where retries or failovers are needed
- jump directly into the exact workspace that needs intervention

They then enter work mode for one session.

Inside the workspace they can:
- continue the conversation with full transcript continuity
- inspect tool cards and artifacts
- approve or deny actions in-context
- retry or edit the task without losing session structure
- keep the calm, high-quality message-first experience

When the session emits new runtime facts, approvals, or quota pressure, the shell updates the same session object in control mode.

The result is the key product feeling:
- the operator is never forced to choose between “good chat UX” and “real operational control”
- the same work is visible as a workspace and as an operational object

That is the pilot-worthy wedge because it demonstrates why Infinity is a new category surface rather than a bundle of existing parts.

## 4. Convergence architecture assumptions

### Product architecture assumption

Infinity is one product with two application surfaces, not one monolith and not two unrelated apps.

### Working assumptions

1. Shell ownership
- `apps/shell` owns global navigation, boards, recoveries, approvals, account capacity, route scope, and durable control-plane APIs.

2. Workspace ownership
- `apps/work-ui` owns transcript, composer, files/artifacts, embedded host mode, and Hermes-grade workspace behavior.

3. Behavioral authority
- Hermes is the behavior reference for session ergonomics, tool cards, approvals, retries, edit flows, and workspace semantics, but not a third root frontend.

4. Visual authority
- FounderOS remains shell-side visual truth.
- Open WebUI adaptation remains workspace visual truth.
- Infinity should not invent a third visual system.

5. Data/control-plane assumption
- source systems remain source systems
- Infinity normalizes control-plane truth rather than pretending to replace all upstream semantics
- session identity and event normalization are the critical seam

6. Runtime assumption
- structured execution events are rich enough to power calm operator UX without exposing raw CLI output as the product surface

7. Durability assumption
- approvals, recoveries, sessions, quota snapshots, and audit events must persist through a shell-owned durability layer, not process-local state

### Architecture formula

Source systems + normalized control-plane read model + operator shell + embedded workspace module = Infinity.

## 5. Major risks

### 1. Product-positioning risk

If Infinity is described as a “dashboard,” it becomes easy to dismiss.
If it is described as “another chat UI,” it loses the control-plane differentiation.

Mitigation:
Position it as an operator workspace for many AI sessions, not as BI and not as generic chat.

### 2. Integration bloat risk

Trying to fuse everything into one mega-app will recreate the exact complexity the product is meant to tame.

Mitigation:
Preserve the two-mode model and thin integration seams.

### 3. Visual drift risk

A local scaffold aesthetic could drift away from FounderOS and Open WebUI references and create an incoherent product.

Mitigation:
Keep FounderOS as shell authority and Open WebUI as workspace authority.

### 4. Truth-model risk

If quotas, approvals, recoveries, and session state live in multiple competing places, operator trust collapses.

Mitigation:
Keep a single normalized control-plane seam and explicit ownership boundaries.

### 5. Pilot-scope risk

A pilot that tries to prove every board, every telemetry lane, and every backend integration will become too large and unclear.

Mitigation:
Pilot only the minimal loop that proves “one session, two modes, shared truth, visible recoveries.”

### 6. Customer-understanding risk

The first users may not naturally understand why this is better than using separate chat tabs and scripts.

Mitigation:
Design the pilot around one vivid operational story with measurable workflow compression.

## 6. Concrete pilot milestone

### Pilot milestone name

Managed AI Workloop Pilot

### Pilot objective

Prove that Infinity can manage one real operator workflow from detection to intervention to completion across both control mode and work mode.

### Pilot success criteria

A pilot user can:
1. see active sessions in the shell by project/group/account
2. detect one blocked, failed, or approval-waiting session
3. open the exact workspace from the shell
4. intervene in-context in the workspace
5. return to the shell and see the same session state updated
6. review a minimal audit/recovery trail without leaving the product

### What must be real in the pilot

- real session list and deep-linking from shell to workspace
- real embedded workspace launch
- real approval/retry/recovery handling for at least one flow
- real account/quota signal for prioritization, even if simplified
- real shared session identity and normalized event propagation

### What can remain intentionally thin

- broad analytics
- large-scale multi-team administration
- full source-plane breadth across every adapter
- elaborate reporting
- polished enterprise permissions

### Pilot story to demo and sell

“An operator sees that a high-priority session is blocked, jumps from the portfolio shell into the live workspace, resolves the issue, retries the run, and watches the control plane reflect the recovery immediately.”

That is concrete, believable, and emotionally legible.

## 7. Recommended next tasks

### Immediate next 5 tasks

1. Write a pilot narrative and demo script
- one canonical before/during/after story
- one target user
- one blocked-session recovery loop

2. Define the pilot contract surface
- exact shell views included in pilot
- exact workspace capabilities included in pilot
- exact event/state transitions that must be live

3. Freeze the pilot ICP and messaging
- operator/team persona
- pains
- promise
- why Infinity instead of separate tools

4. Instrument the core shared-truth loop
- session identity
- approval state
- retry/recovery state
- quota/capacity signal
- audit touchpoints

5. Build a pilot-readiness checklist
- launch path works
- shell-to-workspace deep link works
- one recovery flow works end-to-end
- one approval flow works end-to-end
- same session object updates in both modes

### Recommended follow-on workstreams

- Messaging and positioning brief for external use
- Pilot-specific UX acceptance criteria
- Demo dataset/fixtures for reliable storytelling
- Minimal operator metrics for pilot evaluation
- Narrow design alignment pass to keep shell/workspace visually coherent

## 8. Bottom line

Infinity should be the primary sellable surface.

Not because it combines everything, but because it gives the market something the ingredients do not provide on their own:
- an operator-grade shell
- a premium work-grade workspace
- one shared reality between them

The right near-term move is not “finish every possible feature.”
It is to prove the managed AI workloop with a pilot that shows one session can move cleanly between supervision and execution without losing context, calmness, or truth.
