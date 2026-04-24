# Browser E2E Runnable Result Remediation TZ

## Status

Draft implementation TZ for the next remediation agent.

This document supersedes any claim that Infinity is already fully working from idea to finished localhost app. The current validated posture is stronger than the older scaffold audits, but a fresh manual browser run still failed the product's own solo-v1 acceptance path.

## Goal

Make Infinity work end-to-end for a single local operator:

1. the user opens the shell root `/` in a browser;
2. enters a new product idea;
3. sees the idea become a brief and task graph;
4. sees work units assigned to code-agent attempts;
5. sees completed work units assembled into one result;
6. sees verification pass;
7. sees a truthful delivery/handoff record;
8. opens a real localhost preview of the generated application.

The product is not being prepared for public multi-user release in this cycle. Multi-user auth, registrations, public-cloud hardening, billing, and broad redesign remain out of scope. Full local functionality is in scope.

## Current Failure Evidence

The latest manual browser audit created a real run from `/`:

- initiative: `initiative-1776973563494-orml3fx5`
- workspace session: `session-1776973563495-lr58pgeq`
- user request: a tiny tip calculator web app
- observed state: `failed` / `blocked`
- failed check: `targeted_tests_passed`
- delivery: `null`
- delivery href: `null`

The run page showed all 9 work units completed, but verification failed before delivery. The same `npm run test:orchestration-readiness --workspace @founderos/web` command passed when run directly afterwards, which points to runtime validation environment/state isolation rather than a permanently failing unit test.

This violates the existing final acceptance gate in `2026-04-23-fully-working-solo-v1-hardening-plan.md`: a real one-prompt browser run must produce `preview_ready`, `handoff_ready`, and `launch_kind = runnable_result`.

## Recommended First Implementation Slice

Do not start with broad UI work or delivery redesign. The first slice should be:

1. preserve the observed failing run shape as a regression fixture;
2. build the runtime validation environment isolation;
3. prove direct CLI readiness and in-product readiness behave the same;
4. expose richer failed verification details in the continuity API/UI;
5. rerun the same browser prompt and confirm the run no longer blocks on unrelated inherited env.

Only after this slice is green should agents proceed to delivery truth, browser E2E automation, and release-packet changes.

## Non-Negotiable Acceptance Criteria

The remediation is complete only when all of the following are true from a clean checkpointed tree:

- `git status --short` is empty before the final claim.
- `npm run shell:test` passes.
- `NODE_OPTIONS='--max-old-space-size=1280' npm run work-ui:check` passes.
- `cd /Users/martin/infinity/services/execution-kernel && go test ./...` passes.
- `npm run validate:full` passes without relying on no-op product proof for the user-facing autonomous flow.
- A new browser E2E gate passes for a fresh, non-fixture idea.
- The final browser E2E packet includes screenshots, DOM snapshots, API snapshots, delivery manifest, preview proof, and health proof.
- A manual run from `/` reaches `delivery.ready`.
- `delivery.launchProofKind` or equivalent manifest field is `runnable_result`.
- The generated preview opens in the browser and is not a placeholder scaffold.
- Restarting the local stack preserves continuity and delivery state.

## Operating Constraints

- Work only inside `/Users/martin/infinity`.
- Treat `/Users/martin/FounderOS`, `/Users/martin/open-webui`, `/Users/martin/hermes-web-ui`, and external cabinet snapshots as read-only references.
- Do not redesign the shell or workspace while fixing delivery truth.
- Do not introduce watcher-heavy validation. Any browser/dev-server process started by tests must be managed and stopped by the runner.
- Keep the solo-local posture explicit: file-backed state is acceptable for this cycle, but public/cloud claims are not.

## Primary Implementation Targets

Use the existing validation and orchestration structure. Do not create a second parallel validation framework unless the existing runner is proven impossible to extend.

Likely touch points:

- root `package.json`: add `browser:e2e:solo` and wire it into final validation.
- `scripts/validation/run_infinity_validation.py`: extend the existing Playwright runner and final packet schema.
- `apps/shell/apps/web/lib/server/orchestration/validation.ts`: isolate runtime verification environment and improve failure evidence.
- `apps/shell/apps/web/lib/server/orchestration/delivery.ts`: enforce runnable delivery truth.
- `apps/shell/apps/web/lib/server/orchestration/artifacts.ts`: make manifest/proof fields explicit.
- `apps/shell/apps/web/components/execution/primary-run-surface.tsx`: expose verification/delivery failures clearly.
- `apps/shell/apps/web/components/orchestration/continuity-workspace.tsx`: show blocked/delivery evidence without raw JSON.
- `docs/validation/README.md`: document browser E2E as a release gate.

Do not touch reference repos. If comparison with FounderOS/Open WebUI/Hermes is needed, copy notes into this repo or cite them as read-only references.

## Known Existing Validator Traps

The current validator already uses Playwright and already captures screenshots, so the remediation should extend it rather than starting from zero. However, it has traps that must be removed before it can be treated as final product proof:

- The current happy path prompt is fixed validation text, not a user-like app idea.
- The validation runner currently injects `FOUNDEROS_ORCHESTRATION_VALIDATION_COMMANDS_JSON` with no-op `node -e process.exit(0)` commands for the in-product verification buckets.
- The final functional status is computed from checks and scenarios even while the critic report remains `pending_external_critic`.
- Existing screenshots prove shell/work-ui surfaces, but do not yet prove that the generated preview is a prompt-derived app with working interactions.
- Existing route/API matrices are useful coverage evidence, but they are not enough to prove the user-facing idea-to-app path.

Required correction: the final release packet must separate `repo_checks`, `browser_product_e2e`, `critic`, and `release_readiness` so nobody can mistake a partial green for full solo-product readiness.

## Phase 0 - Reproduce and Preserve the Failure

### Task 0.1: Capture the current failing run as a regression fixture

Description: Save the observed failure shape in tests/fixtures or validation fixtures without copying private user data beyond the local prompt/run IDs needed for debugging.

Acceptance criteria:

- The fixture records initiative status, verification checks, missing delivery, and failed `targeted_tests_passed` check.
- The fixture is used by at least one test that asserts the UI/API reports blocked delivery honestly.
- No test expects failed runs to have `deliveryHref`.

Verification:

- Run the focused test that consumes the fixture.
- Open the run page and confirm failed verification is visible as blocked, not delivered.

### Task 0.2: Add a current-state diagnosis note to the validation packet policy

Description: Document that a passed validation packet is not sufficient unless the real browser E2E product proof also passes.

Acceptance criteria:

- `docs/validation/README.md` distinguishes repo checks, functional validator, screenshot critic, and browser product E2E.
- The docs state that pending critic or missing browser E2E prevents final-release-ready claims.

Verification:

- Documentation review only.

## Phase 1 - Fix Runtime Verification Isolation

### Task 1.1: Introduce a dedicated runtime validation environment builder

Description: Replace ad hoc inherited `process.env` usage in orchestration verification with an explicit environment builder. The builder must preserve only required OS/runtime variables and inject the state/kernel/work-ui values for the run being verified.

Minimum behavior:

- Always set `FOUNDEROS_CONTROL_PLANE_STATE_DIR` to the run's intended state dir.
- Always set `FOUNDEROS_EXECUTION_KERNEL_BASE_URL` to the intended kernel base URL.
- Always set `FOUNDEROS_WORK_UI_BASE_URL` and shell origin when needed.
- Do not inherit stale `FOUNDEROS_ORCHESTRATION_VALIDATION_COMMANDS_JSON` unless explicitly passed for a test fixture.
- Do not inherit dev-server-only values that point tests at the live shell state.
- Keep `PATH`, `HOME`, and package-manager variables needed to run `npm`/`go`.

Acceptance criteria:

- Live verification and direct CLI verification produce the same result for `test:orchestration-readiness`.
- A failed app run can be retried without being poisoned by the previous shell process env.
- Existing unit tests can still override validation commands deliberately.

Verification:

- Focused unit test for the env builder.
- Focused integration test that simulates dev-server env pollution and proves verification still uses isolated temp state.
- Direct rerun: `npm run test:orchestration-readiness --workspace @founderos/web`.

### Task 1.2: Make verification command output complete enough for operator debugging

Description: Current failure details are too compressed for a human to fix from the UI. Expand persisted failure details without dumping huge logs.

Acceptance criteria:

- Each failed verification check stores command, cwd, exit code, stdout snippet, stderr snippet, and artifact path.
- The run UI and continuity API expose those fields.
- The UI shows the failing check name and exact command.

Verification:

- Browser check on a deliberately failed verification.
- API check against `/api/control/orchestration/continuity/[initiativeId]`.

## Phase 2 - Make Runnable Delivery Truthful and Reliable

### Task 2.1: Lock the delivery state machine

Description: Delivery must be created only after assembly, verification, and localhost proof have all passed.

Required states:

- `attempt_scaffold`: intermediate evidence bundle, never final delivery.
- `assembly_ready`: all work-unit artifacts are collected.
- `verification_passed`: static/test validation passed against the isolated run state.
- `runnable_result`: generated app has a real entrypoint and preview proof.
- `delivery.ready`: final handoff record exists and links to preview/manifest.

Acceptance criteria:

- No UI or API calls a run delivered when `delivery = null`.
- `delivery.ready` cannot be persisted unless `launchProofKind = runnable_result`.
- Failed verification leaves a retryable blocked run with a recovery incident.

Verification:

- Unit tests for state transitions.
- Integration test for blocked verification.
- Integration test for successful delivery.

### Task 2.2: Generate a real minimal runnable result for solo-v1

Description: The final integration step must produce a small static or Vite-style app bundle that can be opened through the shell preview route. This does not need to be a perfect full-codegen platform, but it must be a real app result, not a generic placeholder.

Minimum output:

- `index.html`
- a generated app script or bundled JS file
- manifest with prompt, generatedAt, entrypoint, launch command, preview URL, source work units, and proof kind
- localhost proof marker fetched over HTTP

Acceptance criteria:

- The tip calculator/browser smoke prompt produces visible inputs and result text relevant to the prompt.
- The output is prompt-derived enough to prove it is not a fixed canned page.
- The preview URL returns HTTP 200 and renders in browser.

Verification:

- Browser E2E checks text and interactive behavior for a simple prompt.
- Manifest schema test.
- Preview route test.

### Task 2.3: Add delivery retry semantics

Description: If verification fails or preview proof fails, the operator can retry verification/delivery without recreating the whole initiative.

Acceptance criteria:

- Blocked run exposes `Force retry`.
- Retry creates a new verification record and either a ready delivery or a new failed incident.
- Old failed evidence remains inspectable.

Verification:

- Browser negative path: cause failure, click retry, observe new verification ID.
- API test for recovery incident and retry audit event.

## Phase 3 - Make Browser E2E a First-Class Validation Gate

### Task 3.1: Add `browser:e2e:solo`

Description: Add a managed browser validation command that tests the product like the user does, not like a fixture-only backend probe.

Recommended command:

```bash
npm run browser:e2e:solo
```

Required behavior:

- Start or reuse a managed localhost stack only for the test window.
- Use isolated state.
- Open `http://127.0.0.1:3737/`.
- Submit a fresh non-fixture prompt.
- Wait for task graph creation.
- Verify work units and agent attempts are visible.
- Wait for assembly and verification.
- Open delivery.
- Open preview.
- Capture screenshots and DOM snapshots at every major phase.
- Stop any processes it started.

Acceptance criteria:

- The command fails if the run blocks.
- The command fails if preview/delivery is absent.
- The command fails if the app preview is a generic placeholder.
- The command writes a machine-readable report under `handoff-packets/browser-e2e/<run-id>/`.

Verification:

- Run `npm run browser:e2e:solo`.
- Inspect the generated report and screenshots.

Required report shape:

```json
{
  "run_id": "browser-e2e-...",
  "started_at": "ISO-8601",
  "finished_at": "ISO-8601",
  "status": "passed | failed",
  "prompt": "Build a tiny invoice generator...",
  "initiative_id": "initiative-...",
  "session_id": "session-...",
  "task_graph_id": "task-graph-...",
  "batch_ids": ["batch-..."],
  "work_units": [
    {
      "id": "work-unit-...",
      "status": "completed",
      "executor": "codex",
      "attempt_ids": ["attempt-..."],
      "artifact_paths": ["..."]
    }
  ],
  "verification": {
    "id": "verification-...",
    "overall_status": "passed",
    "failed_checks": []
  },
  "delivery": {
    "id": "delivery-...",
    "status": "ready",
    "launch_proof_kind": "runnable_result",
    "manifest_path": "...",
    "preview_url": "http://127.0.0.1:3737/..."
  },
  "preview": {
    "http_status": 200,
    "dom_assertions": ["..."],
    "interaction_assertions": ["..."]
  },
  "artifacts": {
    "screenshots_dir": "...",
    "dom_snapshots_dir": "...",
    "api_snapshots_dir": "...",
    "manual_checklist_path": "..."
  }
}
```

The report must be generated from observed browser/API state. It must not be hand-authored after the fact.

### Task 3.2: Integrate browser E2E into `validate:full`

Description: `validate:full` must not claim final product readiness unless browser E2E passes or explicitly records that it was skipped for a named reason.

Acceptance criteria:

- Default full validation includes browser E2E when local ports are available.
- If browser E2E is skipped, final summary status is not `passed-final-release`; it is `functional-only` or equivalent.
- Final summary links to browser evidence.

Verification:

- Run `npm run validate:full`.
- Confirm final summary includes browser E2E status and artifact path.

### Task 3.3: Add manual browser checklist to the validation packet

Description: Every final packet should include a human-readable checklist matching Martin's testing style.

Checklist must include:

- root frontdoor visible;
- prompt submitted;
- brief created;
- task graph visible;
- microtasks visible;
- attempts visible;
- assembly visible;
- verification passed;
- delivery ready;
- preview opened;
- generated app interacted with;
- restart continuity checked.

Acceptance criteria:

- The packet has `manual-browser-checklist.md`.
- The checklist is generated from actual run evidence, not hand-written assumptions.

Verification:

- Compare checklist items with API/browser snapshots.

## Phase 4 - Improve Operator Visibility for the Real Flow

### Task 4.1: Make task graph and microtask execution inspectable

Description: The run page must show enough detail for a solo operator to understand how the idea was split and executed.

Acceptance criteria:

- Run page links to brief, task graph, batch, and delivery.
- Each work unit shows id, scope, acceptance criteria, executor, attempt count, status, artifact/evidence link, and failure reason if any.
- Agent/attempt labels are visible without opening raw JSON.

Verification:

- Browser E2E asserts visible work-unit cards after planning.
- Browser E2E asserts completed attempt evidence before delivery.

### Task 4.2: Make failure/recovery visible but secondary

Description: Recoveries and approvals must remain operator surfaces, not chat-canvas clutter, while still being usable during blocked runs.

Acceptance criteria:

- Blocked run shows recovery incident and retry action.
- Recoveries board filters by session/initiative.
- Approval/recovery actions write audit events.
- Workspace link remains available, but admin surfaces do not overtake the workspace.

Verification:

- Browser negative path.
- API audit event check.

### Task 4.3: Make delivery page useful

Description: Delivery page should be the final proof page for the generated app.

Acceptance criteria:

- Delivery page shows result summary, preview URL, manifest path, local output path, launch command, proof kind, and source work units.
- If delivery is absent, the page explains which gate failed and links to continuity.
- Preview opens from delivery page in browser.

Verification:

- Browser E2E opens delivery and preview.

## Phase 5 - Validation Honesty and Release Hygiene

### Task 5.1: Remove release-path no-op proof

Description: Keep no-op validation commands only for unit-test fixtures. Release validation cannot use `node -e process.exit(0)` as proof that the autonomous product flow works.

Acceptance criteria:

- `validate:full` final product proof uses real browser E2E evidence.
- Test fixtures may still inject no-op commands but are clearly labeled fixture-only.
- Final summary separates `repo_checks`, `browser_product_e2e`, `critic`, and `release_readiness`.

Verification:

- Inspect validation packet JSON.
- Run full validation.

### Task 5.2: Clean tracked state drift

Description: Resolve the current `next-env.d.ts` drift and prevent validator/dev runs from leaving tracked changes.

Acceptance criteria:

- `apps/shell/apps/web/next-env.d.ts` matches the documented canonical state, or the acceptance note is updated with a new intentional policy.
- Running the validator does not change tracked files.
- `git status --short` is clean after final validation.

Verification:

- Capture `git status --short` before and after validation.

### Task 5.3: Final critic and release packet

Description: Final release evidence must include functional validation, browser E2E, screenshot critic, and manual checklist.

Acceptance criteria:

- Critic JSON is finalized, not pending.
- No unresolved `must_fix`.
- `overall_score > 7.0`.
- No core cluster below `6.5`.
- Final acceptance note names the exact commit and validation packet.

Verification:

- Run critic finalizer.
- Review final packet summary.

## Final Acceptance Runbook

Run these commands from `/Users/martin/infinity`:

```bash
git status --short
npm run shell:test
NODE_OPTIONS='--max-old-space-size=1280' npm run work-ui:check
cd /Users/martin/infinity/services/execution-kernel && go test ./...
cd /Users/martin/infinity
npm run browser:e2e:solo
npm run validate:full
curl -sf http://127.0.0.1:8798/healthz
git status --short
```

Then perform one human browser run:

1. Open `http://127.0.0.1:3737/`.
2. Submit: `Build a tiny invoice generator with client name, line item amount, tax percent, and a printable total.`
3. Confirm the run page opens.
4. Confirm the brief is visible.
5. Confirm task graph/microtasks are visible.
6. Confirm each microtask gets an executor/attempt.
7. Confirm completed tasks show evidence.
8. Confirm verification passes.
9. Confirm delivery is ready.
10. Open preview.
11. Enter sample values in the generated app and confirm the total changes.
12. Restart the stack.
13. Reopen continuity URL and confirm delivery/preview metadata persists.

## Parallel Workstreams

These can run in parallel after Phase 1 contracts are clear:

- Verification isolation owner: Phase 1.
- Delivery truth owner: Phase 2.
- Browser E2E owner: Phase 3.
- Operator UI owner: Phase 4.
- Validation/release owner: Phase 5.

Coordination rule: no workstream may change the core delivery status names or browser E2E report schema without updating this TZ and the validation README in the same PR.

## Merge Checkpoints

Use these gates instead of merging every workstream independently.

### Checkpoint A - Verification Isolation

Required before delivery/browser work can claim correctness:

- runtime validation env builder exists;
- dev-server env pollution regression test passes;
- direct and in-product `test:orchestration-readiness` behavior is aligned;
- failed verification evidence includes command, cwd, exit code, stdout/stderr snippets, and artifact path.

Merge decision:

- GO if a browser-created run no longer fails because of inherited shell/dev-server state;
- NO-GO if direct CLI tests pass but in-product verification can still fail from unrelated inherited env.

### Checkpoint B - Delivery Truth

Required before browser E2E can be marked release-blocking:

- delivery is impossible without passed verification and runnable preview proof;
- `attempt_scaffold` cannot be labeled as final delivery;
- blocked runs create recovery incidents and keep failed evidence inspectable;
- preview route returns real generated output, not a fixed placeholder.

Merge decision:

- GO if a controlled successful run creates `delivery.ready` with `runnable_result`;
- NO-GO if any UI/API surface says delivered while `delivery = null`.

### Checkpoint C - Browser Product E2E

Required before final validation docs can say the product is solo-use ready:

- `npm run browser:e2e:solo` exists;
- the command starts/reuses a managed stack safely;
- it submits a fresh prompt from `/`;
- it observes planning, work units, attempts, assembly, verification, delivery, and preview;
- it writes the required JSON report, screenshots, DOM snapshots, API snapshots, and manual checklist.

Merge decision:

- GO if the command fails on the known blocked-run shape and passes on a real runnable result;
- NO-GO if it only probes seeded fixtures or accepts a placeholder preview.

### Checkpoint D - Final Release Packet

Required for the final "done" claim:

- repo checks pass;
- browser product E2E passes;
- screenshot critic is finalized, not pending;
- no unresolved `must_fix`;
- final acceptance note names exact commit and packet;
- `git status --short` is clean after validation.

Merge decision:

- GO if a human can reproduce the full flow from `/` using the runbook below;
- NO-GO if final status is green while browser E2E is skipped, pending, or fixture-only.

## Subagent Handoff Prompts

### Verification Isolation Owner

```text
Work only inside /Users/martin/infinity. Fix runtime verification isolation for orchestration runs. Focus on apps/shell/apps/web/lib/server/orchestration/validation.ts and related tests. The observed failure is that a browser-created run failed targeted_tests_passed while the same readiness test passed directly afterwards. Build an explicit validation env builder, prevent stale dev-server/process env from leaking into verification, preserve fixture override capability, and add regression tests. Do not touch delivery UI except for exposing richer failure fields if needed.
```

### Delivery Truth Owner

```text
Work only inside /Users/martin/infinity. Make delivery.ready truthful. Focus on orchestration delivery/artifact/verification code. A run may only become delivered after assembly exists, verification passes, localhost proof passes, and a real runnable_result manifest exists. attempt_scaffold is never final delivery. Add tests for failed verification, failed preview proof, and successful runnable delivery. Do not change the shell design language.
```

### Browser E2E Owner

```text
Work only inside /Users/martin/infinity. Add npm run browser:e2e:solo using the existing Playwright validation runner where possible. The test must open /, submit a fresh prompt, observe task graph/work units/attempts, wait for delivery.ready, open preview, interact with the generated app, and write screenshots, DOM snapshots, API snapshots, a JSON report, and manual-browser-checklist.md. The command must fail on blocked runs, null delivery, non-runnable launch kind, or placeholder-only preview.
```

### Operator UI Owner

```text
Work only inside /Users/martin/infinity. Improve only the operator visibility needed for the real flow. On the run and continuity surfaces, show brief/task graph/work units/attempt evidence, failed verification details, delivery state, and retry/recovery links. Do not redesign the product. Do not show raw CLI JSON as the UI. Keep recoveries secondary but usable.
```

### Validation Release Owner

```text
Work only inside /Users/martin/infinity. Update docs/validation and validation packet generation so final readiness requires repo checks, browser product E2E, screenshot critic, manual checklist, clean tree proof, and health proof. Remove or quarantine no-op product proof from release-path validation. The final acceptance note must name the exact commit and validation packet.
```

## Final GO/NO-GO Rule

GO only if a fresh browser prompt produces a real previewable app and the final packet proves it.

NO-GO if any of these are true:

- the run blocks before delivery;
- delivery is null;
- preview is missing or placeholder-only;
- browser E2E is skipped but final status says passed;
- critic remains pending;
- working tree is dirty;
- validation uses fixture-only no-op proof for the user-facing autonomous flow.
