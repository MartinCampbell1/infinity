# Infinity Production Readiness

This project separates local delivery proof from hosted production readiness. A
local runnable result is useful, but it is not a production release claim.

## Readiness tiers

| Tier | Meaning | Required proof |
| --- | --- | --- |
| `local_solo` | A single local operator can run the shell, work UI, kernel, and localhost delivery proof. | Runnable-result launch manifest plus local preview proof. |
| `staging` | Strict rollout environment is enabled, but the delivery still lacks hosted proof. | `FOUNDEROS_REQUIRE_EXPLICIT_ROLLOUT_ENV=1` plus explicit shell/workspace rollout envs. |
| `production` | The delivery can use production wording. | Strict rollout env plus an attached external proof manifest. |

## Copy rule

`delivery.ready`, local preview proof, and a local handoff packet must be shown
with their tier. Local evidence should use wording like `local runnable proof`
or `handoff packet`, not `production ready` or unqualified `handoff ready`.

Production wording is allowed only when all of these are true:

1. `FOUNDEROS_REQUIRE_EXPLICIT_ROLLOUT_ENV=1`.
2. The shell response resolves `readinessTier` to `production`.
3. The delivery has an external proof manifest attached.

If any condition is missing, UI and validation output must downgrade to
`local_solo` or `staging` wording.

## External delivery smoke

P0-BE-14 delivery proof is stronger than local runnable proof. It requires a
real GitHub PR, a hosted preview, CI proof, and signed object-store artifacts.
The repo-local command is:

```bash
npm run external-delivery:preflight --workspace @founderos/web
npm run test:external-delivery-smoke --workspace @founderos/web
```

Both commands are intentionally fail-closed. The preflight performs read-only
GitHub repo/base-branch access checks, Vercel project discovery, and the
mutation guard without creating a PR or deployment. The smoke command only runs
the live provider path when all required environment keys are present:

```text
FOUNDEROS_DEPLOYMENT_ENV=staging
FOUNDEROS_EXTERNAL_DELIVERY_MODE=github_vercel
FOUNDEROS_GITHUB_TOKEN
FOUNDEROS_GITHUB_REPOSITORY
FOUNDEROS_GITHUB_BASE_BRANCH
FOUNDEROS_VERCEL_TOKEN
FOUNDEROS_VERCEL_PROJECT_ID
FOUNDEROS_VERCEL_GIT_REPO_ID
FOUNDEROS_VERCEL_TEAM_ID or FOUNDEROS_VERCEL_TEAM_SLUG when the project lives in a team
FOUNDEROS_VERCEL_PROTECTION_BYPASS_SECRET when signed/preview URLs are behind Vercel Deployment Protection
FOUNDEROS_ARTIFACT_STORE_MODE=s3|gcs|r2|object
FOUNDEROS_ARTIFACT_STORAGE_URI_PREFIX
FOUNDEROS_ARTIFACT_SIGNED_URL_BASE
FOUNDEROS_ARTIFACT_SIGNING_SECRET
FOUNDEROS_ARTIFACT_OBJECT_MIRROR_ROOT unless FOUNDEROS_ARTIFACT_OBJECT_BACKEND=vercel_blob
FOUNDEROS_ARTIFACT_OBJECT_BACKEND=vercel_blob when using Vercel Blob private storage
BLOB_READ_WRITE_TOKEN or FOUNDEROS_VERCEL_BLOB_READ_WRITE_TOKEN when using Vercel Blob private storage
FOUNDEROS_EXTERNAL_PREVIEW_EXPECTED_TEXT
FOUNDEROS_EXTERNAL_DELIVERY_ALLOW_MUTATIONS=1
```

`FOUNDEROS_VERCEL_TOKEN` must be an API token for the Vercel account or team
that owns `FOUNDEROS_VERCEL_PROJECT_ID`. A browser-created project is not enough
if the token cannot read that project or create preview deployments through the
REST API. Team-owned projects should set `FOUNDEROS_VERCEL_TEAM_ID` or
`FOUNDEROS_VERCEL_TEAM_SLUG`; the Vercel REST API uses these as `teamId` or
`slug` query parameters.

If a project is visible in the Vercel UI but preflight still reports
`Project not found`, create or use a Vercel API token from the same personal or
team workspace that owns that project, then rerun the read-only preflight before
running the mutating smoke. The discovery command also prints read-only access
diagnostics for this case, including scoped project count, personal project
count, and team-listing status.

Preflight and smoke also probe `FOUNDEROS_ARTIFACT_SIGNED_URL_BASE` with a dummy
signed-artifact request. A deployed route should reject the dummy request with
the shell route's `403` JSON `artifact_unavailable` response. A `404` means the
hosted shell does not contain the artifact download route yet. A `401` means the
route is behind Vercel Deployment Protection and the smoke needs
`FOUNDEROS_VERCEL_PROTECTION_BYPASS_SECRET`, which is sent as the
`x-vercel-protection-bypass` header documented by Vercel for automation.
Either failure stops the smoke before creating a GitHub delivery PR or Vercel
preview deployment.

The signed artifact download endpoint is intentionally reachable without a
control-plane actor token. The expiring HMAC URL is the authorization boundary
for artifact bytes; CORS checks still apply for browser requests with an
`Origin` header. This keeps UI downloads and external smoke downloads working
after deploy, including protected Vercel previews where automation supplies the
Vercel bypass header.

`FOUNDEROS_ARTIFACT_STORE_MODE=local` is never valid for this smoke. The live
test also rejects `file://`, localhost, `127.0.0.1`, `0.0.0.0`, and `/Users/`
paths in the hosted preview and signed artifact evidence. The staging launcher
also rejects object mirror roots under `/tmp`, `/var/tmp`, `/var/folders`, or
`/Users`; those are local scratch locations that a hosted runtime cannot read
after deploy. For Vercel-hosted staging, set
`FOUNDEROS_ARTIFACT_OBJECT_BACKEND=vercel_blob` with a private Vercel Blob store
and a Blob read/write token; that backend does not use a local mirror root.
Before it creates or updates a GitHub delivery branch/PR, the smoke also
downloads the signed manifest and at least one signed artifact through
`FOUNDEROS_ARTIFACT_SIGNED_URL_BASE`, verifies the returned checksum header, and
rejects local path leaks in the downloaded bytes.
The launcher requires `FOUNDEROS_EXTERNAL_DELIVERY_ALLOW_MUTATIONS=1` because a
successful run mutates GitHub and Vercel. The underlying live smoke test also
checks the same flag so direct Vitest execution fails closed before provider
side effects.

A passing smoke must prove all of these in one run:

1. GitHub branch and PR were created or updated for the delivery.
2. The branch contains `delivery-proofs/<deliveryId>.json`.
3. The branch contains
   `apps/shell/apps/web/public/deliveries/<deliveryId>/index.html`.
4. Vercel reports a ready preview deployment.
5. The returned preview URL is
   `https://<deployment>/deliveries/<deliveryId>/index.html`.
6. Fetching that URL returns `FOUNDEROS_EXTERNAL_PREVIEW_EXPECTED_TEXT`.
7. GitHub CI status for the proof commit is successful.
8. The signed manifest and at least one signed artifact are downloadable through
   expiring signed URLs after crossing the hosted artifact download route.
9. The external proof manifest and signed artifact manifest use object/signed
   URLs, not local file paths.

## Latest P0-BE-14 staging evidence

As of 2026-04-25, the external delivery smoke has passed once against real
GitHub, Vercel, and Vercel Blob staging resources. The recorded evidence lives
in `docs/handoffs/2026-04-25-p0-be-14-external-delivery-handoff.md` and
includes:

- GitHub PR: `https://github.com/MartinCampbell1/infinity/pull/7`
- delivery branch: `delivery/delivery-smoke-1777075954563`
- Vercel deployment: `dpl_6wkVjvUUA5QbGo5R7wLGvZj8mSpd`
- preview fetch: `200` with `FOUNDEROS_EXTERNAL_PREVIEW_EXPECTED_TEXT`
- signed manifest and first signed artifact checksum headers
- local path leak checks for signed manifest and first signed artifact

This closes the P0-BE-14 external delivery proof gate for that documented
staging run. It does not by itself make every future release production-ready:
each release still needs a fresh external proof manifest, current credentials,
and the release gates described above.
