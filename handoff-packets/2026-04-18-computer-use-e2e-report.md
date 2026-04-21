# Computer Use E2E Report

Date: 2026-04-18
Workspace: `/Users/martin/infinity`
Method: live browser automation with Computer Use on local shell/work-ui/kernel

## Goal

Attempt the full user-facing path:

`idea as Hermes-style prompt -> planning/execution flow -> finished project report`

## Local Stack

- shell: `http://127.0.0.1:3737`
- work-ui preview: `http://127.0.0.1:3101`
- execution-kernel: `http://127.0.0.1:8798`

## Fresh Smoke Dataset

- `initiativeId`: `initiative-1776498512756-rodh1erg`
- `briefId`: `brief-1776498512774-c3frrs7x`
- `taskGraphId`: `task-graph-initiative-1776498512756-rodh1erg`
- `batchId`: `batch-1776498512782-0j2xszyn`
- `deliveryId`: `delivery-1776498512839-up89u45w`

## What Passed

Browser-accessible shell pages:

- continuity page loaded and rendered real content
- shell showed initiative status, approvals, recoveries, lifecycle, memory sidecar adapter, and deep links

HTTP-level route smoke:

- shell continuity / task-graph / batch / delivery routes returned `200`
- work-ui `project-brief` / `project-run` / `project-result` routes returned `200`

## Runtime Blockers Found In Browser

### 1. Browser-started intake path is not currently usable

Direct navigation to:

- `http://127.0.0.1:3101/project-intake`

redirected to:

- `http://127.0.0.1:3101/auth`

and resulted in `404 Not Found`.

Effect:

- the full user-facing E2E path cannot currently begin from a browser-entered prompt alone in the preview stack

### 2. Direct work-ui embedded routes without launch token fail launch verification

Direct navigation to embedded `project-result` without `launch_token` produced:

- `Workspace launch could not be verified`
- `FounderOS launch verification requires projectId and launchToken`

Effect:

- work-ui routes are not directly usable from a bare embedded URL without a shell-issued launch token context

### 3. Direct cross-origin work-ui route with a shell-issued token still failed launch verification

After extracting a real shell-issued launch token from the shell workspace host HTML and navigating directly to:

- `http://127.0.0.1:3101/project-result/...&launch_token=...`

the page still showed:

- `Workspace launch could not be verified`
- `FounderOS launch verification request failed`

Effect:

- the intended embedded path appears to depend on being opened from the shell host boundary rather than as a direct browser URL on the work-ui origin

## Interpretation

The rollout implementation is locally built, tested, and HTTP-accessible, but the fully user-facing browser path from idea-entry to final report is **not yet fully production-realistic**.

The main gap is not shell orchestration correctness. The main gap is the runtime entry boundary into work-ui:

- standalone intake is not available in the preview runtime
- direct embedded route navigation is not sufficient, even with a token

## Evidence

Related artifacts:

- rollout summary: `/Users/martin/infinity/handoff-packets/2026-04-18-infinity-rollout-complete.md`
- live runtime smoke: `/Users/martin/infinity/handoff-packets/2026-04-18-infinity-live-runtime-smoke.md`
- shell continuity screenshot: `/Users/martin/infinity/handoff-packets/2026-04-18-shell-continuity-smoke.png`
- work-ui result screenshot: `/Users/martin/infinity/handoff-packets/2026-04-18-workui-result-smoke.png`

## Next Practical Fix

Highest-value next slice:

- make the browser-started user path enter through a shell-owned host route that can mint and carry the required launch context into work-ui, instead of expecting direct work-ui URLs to be sufficient
