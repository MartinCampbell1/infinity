# Infinity Security Threat Model

Status: draft for P2-DOC-03 implementation gate
Date: 2026-04-25
Scope: FounderOS shell, embedded work-ui, execution kernel, artifact delivery,
and external providers used by the Infinity control plane.

This document is a threat model, not a production-readiness attestation. It
records the security boundaries that must hold before production wording is
allowed. Production readiness still depends on `docs/production-readiness.md`,
`docs/ops/staging-topology.md`, and the validation packet for the target
deployment.

## Assets

| Asset | Why it matters | Primary owner |
| --- | --- | --- |
| Operator identity and role | Authorizes control-plane reads and mutations. | FounderOS shell |
| Workspace launch token | Proves that a work-ui session was opened by the shell for one session. | Shell workspace launch routes |
| Workspace session grant | Lets embedded work-ui call runtime APIs after launch verification. | Shell session exchange |
| Control-plane records | Durable sessions, approvals, recoveries, quotas, deliveries, and audit events. | Shell storage layer |
| Execution kernel service token | Lets the shell create and mutate kernel batches and attempts. | Shell to kernel client |
| Artifact manifests and signed URLs | Carry delivery evidence and downloadable artifacts. | Artifact store |
| Provider credentials | GitHub, Vercel, OpenAI/app-server, object store, and secret-manager tokens. | Deployment secrets manager |

## Trust Boundaries

1. Browser to shell: operator requests enter the control plane through shell
   routes and must carry an operator or service actor when the route is
   privileged.
2. Shell to embedded work-ui: the shell is the parent frame and work-ui is a
   hosted workspace child. The boundary is a launch/session handshake plus
   explicit `frame-ancestors`, not shared local storage.
3. Work-ui to shell runtime routes: embedded work-ui can exchange a valid
   launch token for a session grant; standalone mode must not inherit embedded
   privileges.
4. Shell to execution kernel: the kernel is an internal service reached through
   a private base URL and scoped service authorization.
5. Shell to artifacts: artifact bytes are exposed through signed URLs with
   checksums and expiry, not raw local filesystem paths in production-like
   environments.
6. Shell to external providers: GitHub, Vercel, OpenAI/app-server, object store,
   and secret-manager calls are provider side effects and must be fail-closed
   unless the deployment environment and credentials are explicit.

## Threats And Required Controls

| Domain | Threat | Required control | Current evidence | Production gap |
| --- | --- | --- | --- | --- |
| Auth | Unauthenticated actor reads or mutates privileged control-plane APIs. | Actor token auth is always required; operator/service roles gate read and mutation; service tokens are accepted only on producer routes. | `apps/shell/apps/web/lib/server/http/control-plane-auth.ts` | Production must prove operator/service secrets exist only in the configured secrets manager and are rotated through an incident path. |
| Auth | Service actor uses broad privileges outside intended ingestion paths. | Service token is scoped to quota producer, workspace runtime, and retention producer paths. | `isServiceProducerPath()` in `control-plane-auth.ts` | Add deployment evidence that public routes cannot reach internal producer paths without the service secret. |
| Tokens | Workspace launch token is replayed for another session or project. | Launch verification binds token, projectId, sessionId, optional group/account/workspace refs, and opened-from context; route sessionId mismatch fails. | workspace `launch-token`, `bootstrap`, `session`, and `session-bearer` routes | Final production launch tokens need short TTL, secret rotation, and no logging of raw token values. |
| Tokens | Embedded work-ui reads legacy browser bearer tokens or stores shell-issued tokens in local storage. | Embedded credential resolver disables legacy localStorage in embedded runtime; local dev sessionStorage is gated by localhost and explicit `founderos_local_dev_storage`. | `scripts/security/check-work-ui-embedded-auth.mjs`, `apps/work-ui/src/lib/founderos/credentials.ts` | Keep the embedded auth gate in CI and verify no future terminal/tool code reads legacy browser tokens. |
| Tokens | Release packets or screenshots leak `launch_token`, access tokens, or provider tokens. | Release packet redacts token-like query params and provider error paths redact configured provider token values. | `scripts/release/generate-release-packet.mjs`, external delivery tests | Extend redaction tests when new token parameter names or provider credentials are introduced. |
| Iframe | Malicious site embeds work-ui and drives privileged workspace actions. | Work-ui sets `frame-ancestors` from explicit shell origins; wildcard and broad `http:`/`https:` ancestors are disallowed by the security gate. | `apps/work-ui/src/hooks.server.ts`, `scripts/security/check-work-ui-embedded-auth.mjs` | Production must set non-local shell and work-ui origins and must not rely on default local frame ancestors. |
| Iframe | Parent/child message spoofing injects hostile bootstrap or file/tool events. | Bootstrap is accepted only after launch-token verification against shell routes; host origin is normalized to an origin. | `apps/work-ui/src/lib/founderos/launch.ts`, `bootstrap.ts` | PostMessage handlers must continue to validate origin and message shape when new bridge messages are added. |
| Kernel | Public clients call execution kernel directly or mutate attempts. | Staging topology requires a private kernel URL, and the shell client signs scoped HMAC service tokens for kernel actions. | `docs/ops/staging-topology.md`, `packages/api-clients/src/multica.ts` | Production should add network policy or equivalent provider rule proving the kernel is not internet-facing. |
| Kernel | A leaked service token grants long-lived kernel mutation. | Kernel service token requires a secret, positive TTL, audience, issuer, and per-request scope. | `signExecutionKernelServiceToken()` | Production should use a managed secret, short TTL, rotation runbook, and kernel-side clock skew handling. |
| Artifacts | Delivery artifacts leak local file paths or are unreadable after deploy. | Production-like storage rejects local/file/localhost `/Users` paths and requires object storage plus signed URL base. | `apps/shell/apps/web/lib/server/orchestration/artifacts.ts`, `docs/production-readiness.md` | Final hosted proof must download signed manifests/artifacts through the deployed route and verify checksums. |
| Artifacts | Signed artifact URL is copied outside the operator context. | Signed URL includes key, checksum, expiry, and HMAC signature; checksum is verified before bytes are returned. | artifact store signing and read paths | Signed URL is still bearer-style access until expiry; TTL and artifact sensitivity must be reviewed per delivery class. |
| Providers | GitHub/Vercel/OpenAI/object-store credentials trigger unintended side effects or leak in errors. | External provider smoke fails closed until staging env, credentials, object storage, and mutation flag are explicit; provider errors are redacted. | `docs/production-readiness.md`, external-delivery smoke/preflight tests | Least-privilege provider scopes and per-environment credential ownership must be reviewed before production. |
| Providers | API-key accounts are treated like ChatGPT quota buckets. | Quota policy separates ChatGPT/app-server canonical quota from API-key capacity semantics. | accounts/quota routes and tests | The provider adapter still needs live app-server evidence for production quota truth. |

## Abuse Cases

### Embedded Workspace Launch From A Hostile Origin

Expected outcome: fail closed. The hostile parent cannot satisfy shell-issued
launch verification, and work-ui should reject broad frame ancestors. A
successful exploit would show work-ui accepting bootstrap/session state without
a valid launch token or from an untrusted parent origin.

### Stolen Launch Token

Expected outcome: limited blast radius. The token must be bound to one project
and session and should expire quickly. It must not mint grants for another
session, another project, or another opened-from scope. Raw launch tokens should
not appear in logs, release packets, screenshots, or handoff artifacts.

### Stolen Kernel Service Secret

Expected outcome: incident response, not silent continuation. A leaked kernel
secret can mutate execution state until revoked. Production must support secret
rotation, service redeploy, and audit review of affected batch/attempt IDs.

### Leaked Signed Artifact URL

Expected outcome: URL works only until expiry and only for the signed key and
checksum. The URL is intentionally the authorization boundary for artifact
bytes, so highly sensitive artifacts require shorter TTLs or a stronger
authenticated download path.

### Provider Credential Misconfiguration

Expected outcome: fail before provider mutations. Missing or local-looking
artifact URLs, missing Vercel/GitHub credentials, invalid repositories, or a
missing mutation confirmation should stop before any live provider side effect.

## Production Security Checklist

- Auth: operator and service secrets are present in the secrets manager, not
  local env files, and privileged routes return structured `401`/`403`/`503`
  failures when credentials are missing or invalid.
- Tokens: launch/session tokens have documented TTL, issuer/audience, rotation,
  redaction, and revocation behavior.
- Iframe: work-ui `frame-ancestors` contains only the intended shell origins;
  no wildcard, broad scheme, or unintended localhost ancestor is present in
  staging or production.
- Kernel: execution kernel URL is private and not listed in public privileged
  API allowed origins; service auth uses scoped short-lived tokens.
- Artifacts: production-like deployments use object storage, expiring signed
  URLs, checksum verification, and no local path evidence.
- Providers: provider credentials are least-privilege, provider errors are
  redacted, and mutating live smoke requires explicit confirmation.
- Logging: request IDs, actor IDs, event IDs, and artifact IDs can be logged;
  raw actor tokens, launch tokens, provider tokens, session grants, and signed
  URL signatures must not be logged.

## Verification Commands

Run from `/Users/martin/infinity`:

```bash
node --test scripts/docs/security-model-doc.test.mjs
npm run docs:security-model:test
git diff --check
```

Optional targeted implementation checks:

```bash
npm run security:embedded-auth
npm run security:audit:critical
```
