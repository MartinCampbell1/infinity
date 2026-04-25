# Infinity Known Limitations

This page is the operator-facing truth table for what the current Infinity build
can and cannot claim. It separates local, staging, and production limits so a
green local run does not get mistaken for a hosted production release.

## Local Limitations

- Local runnable proof is useful for a single operator, but it is not a
  production release claim.
- Local preview URLs, `localhost`, `127.0.0.1`, `file://`, `/tmp`, and `/Users`
  paths cannot be used as hosted delivery evidence.
- Validation packets under `handoff-packets/validation/`,
  `handoff-packets/browser-e2e/`, and `.local-state/` are local evidence, not
  source files.
- Browser product E2E proof is required before claiming that the idea-to-result
  loop works as a user-facing product.
- Local services and ports can be owned by the validator only during its run;
  long-lived watchers or background dev servers are not release proof.

## Staging Limitations

- Staging requires explicit rollout environment configuration, not a localhost
  preview with staging wording.
- The shell and work-ui origins must be separate non-local HTTPS origins.
- The execution kernel must be private and must not be exposed as a public API
  origin.
- Staging artifact storage must be object storage with signed URL support; local
  artifact paths are rejected.
- The P0-BE-14 staging delivery baseline has passed once with real GitHub,
  Vercel, CI, and signed-artifact evidence; each future staging delivery still
  needs fresh external proof for its own release.
- Vercel Deployment Protection, team ownership, and object-store credentials can
  block smoke even when mocked provider tests pass.

## Production Limitations

- Production wording is allowed only when strict rollout env is enabled, the
  shell resolves `readinessTier` to `production`, and an external proof manifest
  is attached.
- Production promotion still depends on a ready staging topology, production-like
  storage, least-privilege provider credentials, and secret ownership review.
- API-key accounts and ChatGPT-authenticated accounts do not share the same
  quota semantics; API-key capacity must not be described as remaining ChatGPT
  quota.
- Hosted artifact downloads depend on expiring signed URLs and checksum proof;
  local file paths or leaked scratch paths invalidate production evidence.
- A delivery can be ready for local or staging review while still missing
  production proof.

## Operator Rule

When evidence is mixed, use the lowest proven tier. Do not upgrade copy from
local to staging, or from staging to production, until the matching proof exists.
