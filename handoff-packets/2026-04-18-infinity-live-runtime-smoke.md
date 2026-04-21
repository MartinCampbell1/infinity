# Infinity Live Runtime Smoke

Date: 2026-04-18
Workspace: `/Users/martin/infinity`

## Services Used

- shell: `http://127.0.0.1:3737`
- work-ui preview: `http://127.0.0.1:3101`
- execution-kernel: `http://127.0.0.1:8798`

## Fresh Smoke Dataset

- `initiativeId`: `initiative-1776498512756-rodh1erg`
- `briefId`: `brief-1776498512774-c3frrs7x`
- `taskGraphId`: `task-graph-initiative-1776498512756-rodh1erg`
- `batchId`: `batch-1776498512782-0j2xszyn`
- `deliveryId`: `delivery-1776498512839-up89u45w`

## HTTP Route Checks

All returned `200`:

- `/execution/continuity/initiative-1776498512756-rodh1erg`
- `/execution/task-graphs/task-graph-initiative-1776498512756-rodh1erg?initiative_id=initiative-1776498512756-rodh1erg`
- `/execution/batches/batch-1776498512782-0j2xszyn?initiative_id=initiative-1776498512756-rodh1erg&task_graph_id=task-graph-initiative-1776498512756-rodh1erg`
- `/execution/delivery/delivery-1776498512839-up89u45w?initiative_id=initiative-1776498512756-rodh1erg`
- `/project-brief/brief-1776498512774-c3frrs7x?...embedded launch params...`
- `/project-run/initiative-1776498512756-rodh1erg?...embedded launch params...`
- `/project-result/initiative-1776498512756-rodh1erg?...embedded launch params...`

## Continuity Snapshot

Live shell continuity API returned a full inspectable chain:

- initiative status: `ready`
- briefs: `1`
- task graphs: `1`
- batches: `1`
- assembly: `assembled`
- verification: `passed`
- delivery: `ready`
- related approvals linked by session: `1`
- related recoveries linked by session: `1`
- Hermes memory sidecar adapter visible with:
  - base URL `http://127.0.0.1:8766`
  - health `/health`
  - schema `/actions/schema`
  - read action path `/actions/knowledgebase`

## Browser Layer

Opened in browser layer:

- shell continuity page
- work-ui project result page

No runtime blocker was observed during navigation.

## Notes

- This smoke used a fresh synthetic initiative chain created through the live shell APIs.
- Temporary shell/work-ui/kernel processes were stopped after the run.
