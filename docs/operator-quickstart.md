# Operator Quickstart

This guide is for a non-developer operator using Infinity through the FounderOS
shell. It explains the first run, how to read the result, and what to do when a
run needs recovery.

## Before You Start

- Open the shell at the environment provided by the deployment or local
  operator. Local development usually uses `http://127.0.0.1:3737/`.
- Use the shell, not a reference repository, as the product entry point.
- Keep credentials, tokens, and external delivery secrets out of prompts and
  screenshots.
- If a run touches external delivery, confirm the operator has approved the
  target project/account first.

## First Run

1. Open the FounderOS shell.
2. Select `New run` from the topbar.
3. Describe the outcome in plain language. Include the desired app/site/tool,
   any repository or workspace constraints, and the acceptance criteria.
4. Review the generated brief. If it is wrong, stop and refine the request
   before approving execution.
5. Let the run move through planning, task graph creation, work execution,
   verification, and delivery.
6. Keep the run open until it reaches a delivery state or asks for operator
   input.

Good first-run prompts name a result, not an implementation detail:

```text
Build a usable internal demo for the Atlas onboarding checklist. It should
show active steps, blocked steps, owner, due date, and a completed-state
summary. Keep it local-only and prove it can be opened in the browser.
```

## Interpreting Results

Read the run as an operational record, not only as a chat transcript:

| Surface | What to check |
| --- | --- |
| Run status | `planning`, `acting`, `validating`, `completed`, `failed`, or `blocked` |
| Task graph | whether the work was split into concrete units and attempts |
| Validation | whether checks actually ran or were skipped with a named reason |
| Delivery | whether there is a runnable result, artifact, preview, or external handoff |
| Evidence | screenshots, API snapshots, logs, tests, and final validation summaries |
| Operator signals | approvals, recoveries, retry prompts, or account/capacity warnings |

Use these rules when deciding whether a result is usable:

- A delivery is not final if browser product E2E is missing for a flow that
  claims a runnable UI result.
- A green static check is useful evidence, but it is not the same as opening
  the result and verifying the core workflow.
- A skipped check is acceptable only when the skip reason is explicit and the
  release/readiness state is downgraded honestly.
- If the run claims external delivery, look for proof from the external target,
  not just a local manifest.
- If the run claims staging or production readiness, check
  `docs/production-readiness.md` and `docs/ops/staging-topology.md` before
  accepting the wording.

## Recovery

Use recovery when a run is blocked, failed, stale, or produced incomplete proof.

1. Open the run from `Execution`.
2. Read the latest error, failed validation, or blocked approval.
3. Decide the smallest safe action:
   - retry the same account when the failure is transient;
   - retry with a fallback account when capacity is exhausted;
   - edit the request if the brief or task graph is wrong;
   - deny or revise an approval when the requested action is unsafe;
   - stop the run when evidence shows the result cannot be trusted.
4. After recovery, verify the run returns to planning, acting, validating, or a
   clearly failed state with a new reason.
5. Do not mark the work complete until the result has fresh evidence after the recovery action.

## When To Escalate

Escalate instead of retrying if:

- the same failure repeats after one targeted retry;
- an approval asks for a destructive or unclear operation;
- credentials, tokens, local private paths, or personal data appear in output;
- delivery evidence conflicts with the final status;
- the browser preview cannot be opened but the run claims a runnable result.

Escalation handoff should include:

- run ID and project;
- current status and last error;
- what was retried or denied;
- validation artifacts checked;
- the next safest action.
