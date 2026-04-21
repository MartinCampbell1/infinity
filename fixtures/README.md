# fixtures/README.md — Canonical Fixture Pack

## Purpose

This directory is the merge gate for runtime normalization and projection work.

No serious event-normalization, quota, approval, or recovery implementation should proceed without raw fixtures and golden outputs living here.

---

## Materialized layout

```text
fixtures/
  README.md
  raw/
    README.md
    codex-jsonl/
      README.md
      manifest.md
    codex-app-server-rate-limits/
      README.md
      capture-template.md
    hermes-sse/
      README.md
      capture-template.md
    codext-session-supervisor/
      README.md
      capture-template.md
  golden/
    README.md
    normalized-events/
      README.md
      manifest.md
    session-projections/
      README.md
      manifest.md
    quota-projections/
      README.md
      manifest.md
```

---

## What each area contains

### raw/codex-jsonl

Real raw output from `codex exec --json`.

Minimum cases:

- thread start;
- turn start and completion;
- assistant message;
- tool execution;
- command execution;
- approval-required or failed turn;
- delegated or forked thread references if available.

### raw/codex-app-server-rate-limits

Captured request, response, or notify examples for:

- `account/rateLimits/read`
- `account/rateLimits/updated`

Include examples for:

- healthy account;
- high-pressure account;
- exhausted account;
- auth-mode differences when available.

### raw/hermes-sse

Raw SSE streams for:

- token;
- tool;
- approval;
- approval resolved or error;
- done;
- error.

### raw/codext-session-supervisor

Raw logs or NDJSON from the supervisor layer.

This is internal-only and must be captured manually if no public source exists.

---

## Golden outputs

### golden/normalized-events

Expected normalized events after adapters run over the raw fixture.

Every golden file must make event identity, ordering, and payload shape explicit.

### golden/session-projections

Expected `ExecutionSessionSummary` and group projections derived from the normalized event stream.

### golden/quota-projections

Expected quota snapshots and derived capacity states from raw quota fixture inputs.

---

## Capture rules

- Keep raw fixtures as raw as possible.
- Do not hand-normalize raw captures.
- Add redaction notes when secrets or tenant-specific identifiers are removed.
- Prefer one scenario per file.
- Include a small sidecar note for each fixture with source system, capture date, and redaction policy.
- Use stable UTC timestamps in metadata.
- Keep file names deterministic and scenario-first.

---

## Minimum scenario matrix

### Event normalization

- Codex happy-path run
- Codex failed run
- Codex approval-required run
- Hermes happy-path run
- Hermes approval-required run
- Mixed session with multiple runtime bindings

### Quota

- ChatGPT-authenticated account with upstream buckets
- ChatGPT-authenticated exhausted account
- API-key account with usage-priced capacity semantics

### Recoveries

- failed -> retryable
- retry same account
- fallback account failover
- approval pending -> resolved

---

## Merge gate

The following streams must treat this directory as mandatory input:

- `05` Event normalization
- `06` Quota and accounts
- `07` Approvals and recoveries
- `08` QA and contract gate

## Operational note

Use the leaf `README.md` and manifest/template files as the handoff surface for capture work.
When a new raw scenario is collected, add the matching golden output in the paired `golden/` bucket before merge.

If a PR changes event mapping, quota derivation, or recovery behavior without updating fixtures and goldens, it is not ready to merge.

## Required metadata for every scenario

Each scenario must be traceable with:

- one raw artifact;
- one manifest row in corresponding `raw/*/manifest` or template-derived note;
- one golden artifact (or explicit "golden not applicable" note for raw-only captures);
- one mapping entry in the relevant golden manifest.
