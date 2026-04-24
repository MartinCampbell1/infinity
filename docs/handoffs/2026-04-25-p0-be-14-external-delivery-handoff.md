# P0-BE-14 External Delivery Handoff

Date: 2026-04-25
Workspace: `/Users/martin/infinity`
Audit plan: `/Users/martin/Downloads/infinity_full_audit_fix_plan_2026-04-24.md`

## Scope

This handoff covers the local P0-BE-14 work for external delivery:

- GitHub PR proof path.
- Vercel hosted preview path.
- CI proof capture.
- Object-store and signed artifact proof.
- Guarded live staging smoke harness.

Reference repos remain read-only:

- `/Users/martin/FounderOS`
- `/Users/martin/open-webui`
- `/Users/martin/hermes-web-ui`

All changes are inside `/Users/martin/infinity`.

## Implemented

The external delivery provider now supports:

- `FOUNDEROS_EXTERNAL_DELIVERY_MODE=disabled`
- `FOUNDEROS_EXTERNAL_DELIVERY_MODE=mock`
- `FOUNDEROS_EXTERNAL_DELIVERY_MODE=github_vercel`

Production-like deployments reject mock mode. The `github_vercel` mode:

- creates or updates a GitHub delivery branch;
- commits `delivery-proofs/<deliveryId>.json`;
- commits `apps/shell/apps/web/public/deliveries/<deliveryId>/index.html`;
- opens or updates the GitHub PR for the delivery branch;
- creates and polls a Vercel preview deployment;
- returns `https://<deployment>/deliveries/<deliveryId>/index.html` as the
  external preview URL;
- reads successful GitHub CI status for the proof commit;
- records CI proof as a GitHub combined commit status
  (`ciProofProvider=github_commit_status`), which can be supplied by Vercel or
  another status publisher;
- preflights Vercel project access before creating or updating GitHub delivery
  refs/PRs, so a bad Vercel token fails before public GitHub mutation;
- redacts configured GitHub/Vercel tokens and token-like provider values from
  provider/discovery error messages;
- stores an external delivery proof manifest through `ArtifactStore`.

Delivery records now carry:

- `externalPullRequestUrl`
- `externalPullRequestId`
- `externalPreviewProvider`
- `externalPreviewDeploymentId`
- `ciProofProvider`
- `ciProofId`
- `externalDeliveryProof`

Strict rollout readiness requires all of these before `delivery.ready` can
persist:

- runnable launch proof;
- external PR URL;
- hosted preview URL;
- external proof manifest;
- CI proof URI;
- object artifact storage URI;
- signed artifact manifest URI.

## Smoke Harness

Run the live smoke with:

```bash
npm run external-delivery:preflight --workspace @founderos/web
npm run test:external-delivery-smoke --workspace @founderos/web
```

The preflight performs read-only Vercel discovery and verifies that live smoke
has explicit mutation confirmation before the operator runs the mutating smoke.
The commands fail closed unless all required env keys are configured:

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

`FOUNDEROS_ARTIFACT_STORE_MODE=local` is rejected. The live test also rejects
`file://`, localhost, `127.0.0.1`, `0.0.0.0`, and `/Users/` paths in
hosted-preview and artifact proof. It downloads the signed manifest and at
least one signed artifact through the configured hosted signed download route
before it mutates GitHub branches or PRs, so a non-durable or non-shared
artifact store fails before external delivery side effects. The launcher also requires
`FOUNDEROS_EXTERNAL_DELIVERY_ALLOW_MUTATIONS=1` as an explicit confirmation for
the GitHub/Vercel side effects.
The underlying `external-delivery.live.test.ts` also checks the same flag so a
direct Vitest run fails closed before provider side effects.

## Latest Verification

These commands passed after the hosted preview payload increment:

```bash
cd /Users/martin/infinity/apps/shell/apps/web && \
npx vitest run scripts/external-delivery-smoke.test.mjs \
  components/orchestration/delivery-summary.test.tsx \
  components/execution/primary-run-surface.test.tsx \
  lib/server/orchestration/delivery-state.test.ts \
  lib/delivery-readiness.test.ts \
  lib/server/orchestration/autonomous-run.test.ts \
  lib/server/orchestration/claude-design-presentation.test.ts \
  lib/server/orchestration/artifacts.test.ts \
  lib/server/orchestration/external-delivery.test.ts \
  lib/server/orchestration/external-delivery.live.test.ts \
  lib/server/orchestration/executor-adapters.test.ts \
  lib/server/control-plane/workspace/rollout-config.test.ts \
  app/api/control/deployment/boot-diagnostics/route.test.ts \
  app/api/control/orchestration/assembly/route.test.ts \
  app/api/control/orchestration/verification/route.test.ts \
  app/api/control/orchestration/delivery/route.test.ts \
  'app/api/control/orchestration/continuity/[initiativeId]/route.test.ts' \
  'app/(shell)/execution/delivery/[deliveryId]/page.test.tsx' \
  'app/(shell)/execution/deliveries/page.test.tsx' \
  'app/(shell)/execution/validation/page.test.tsx'
```

Result:

```text
20 files total, 19 passed / 1 skipped
85 tests total, 84 passed / 1 skipped
```

Additional checks:

```bash
npm run typecheck --workspace @founderos/web
git diff --check
```

Both passed.

These commands also passed after adding the Vercel discovery helper and
auto-sourced smoke scripts:

```bash
npm run typecheck --workspace @founderos/web

cd /Users/martin/infinity/apps/shell/apps/web && \
npx vitest run scripts/external-delivery-smoke.test.mjs \
  components/orchestration/delivery-summary.test.tsx \
  components/execution/primary-run-surface.test.tsx \
  lib/server/orchestration/delivery-state.test.ts \
  lib/delivery-readiness.test.ts \
  lib/server/orchestration/autonomous-run.test.ts \
  lib/server/orchestration/claude-design-presentation.test.ts \
  lib/server/orchestration/artifacts.test.ts \
  lib/server/orchestration/external-delivery.test.ts \
  lib/server/orchestration/external-delivery.live.test.ts \
  lib/server/orchestration/executor-adapters.test.ts \
  lib/server/control-plane/workspace/rollout-config.test.ts \
  app/api/control/deployment/boot-diagnostics/route.test.ts \
  app/api/control/orchestration/assembly/route.test.ts \
  app/api/control/orchestration/verification/route.test.ts \
  app/api/control/orchestration/delivery/route.test.ts \
  'app/api/control/orchestration/continuity/[initiativeId]/route.test.ts' \
  'app/(shell)/execution/delivery/[deliveryId]/page.test.tsx' \
  'app/(shell)/execution/deliveries/page.test.tsx' \
  'app/(shell)/execution/validation/page.test.tsx'

git diff --check
```

Result:

```text
Typecheck passed.
20 test files: 19 passed / 1 skipped.
85 tests: 84 passed / 1 skipped.
git diff --check passed.
```

After the `FOUNDEROS_VERCEL_TEAM_SLUG` fix, the CI proof provider label
correction to `github_commit_status`, and the Vercel preflight guard, the same
focused suite was rerun:

```bash
cd /Users/martin/infinity/apps/shell/apps/web && \
npx vitest run scripts/external-delivery-smoke.test.mjs \
  components/orchestration/delivery-summary.test.tsx \
  components/execution/primary-run-surface.test.tsx \
  lib/server/orchestration/delivery-state.test.ts \
  lib/delivery-readiness.test.ts \
  lib/server/orchestration/autonomous-run.test.ts \
  lib/server/orchestration/claude-design-presentation.test.ts \
  lib/server/orchestration/artifacts.test.ts \
  lib/server/orchestration/external-delivery.test.ts \
  lib/server/orchestration/external-delivery.live.test.ts \
  lib/server/orchestration/executor-adapters.test.ts \
  lib/server/control-plane/workspace/rollout-config.test.ts \
  app/api/control/deployment/boot-diagnostics/route.test.ts \
  app/api/control/orchestration/assembly/route.test.ts \
  app/api/control/orchestration/verification/route.test.ts \
  app/api/control/orchestration/delivery/route.test.ts \
  'app/api/control/orchestration/continuity/[initiativeId]/route.test.ts' \
  'app/(shell)/execution/delivery/[deliveryId]/page.test.tsx' \
  'app/(shell)/execution/deliveries/page.test.tsx' \
  'app/(shell)/execution/validation/page.test.tsx'
```

Result:

```text
20 test files: 19 passed / 1 skipped.
85 tests: 84 passed / 1 skipped.
```

The explicit live smoke was also tested without env:

```bash
npm run test:external-delivery-smoke --workspace @founderos/web
```

It correctly failed closed because the current shell has no live GitHub,
Vercel, or object artifact env.

After the Vercel UI setup, the staging env was filled with:

- `FOUNDEROS_VERCEL_PROJECT_ID=prj_vhshLn5INcinxWrSaSUbws6FImPf`
- `FOUNDEROS_VERCEL_TEAM_SLUG=ls-projects-adb8778b`
- `FOUNDEROS_ARTIFACT_STORAGE_URI_PREFIX=object://infinity-staging`
- `FOUNDEROS_ARTIFACT_SIGNED_URL_BASE=https://infinity-web-iota.vercel.app/api/control/orchestration/artifacts/download`

The smoke launcher now fails closed only if that project id is removed. The
live smoke has not been run with provider side effects after this env fill,
because it would create or update a public GitHub delivery branch/PR and a
Vercel preview deployment.

After the signed-download live smoke fix, the explicit mutation guard, and
provider-error redaction, these commands passed again:

```bash
cd /Users/martin/infinity/apps/shell/apps/web && \
npx vitest run lib/server/orchestration/external-delivery.live.test.ts \
  scripts/external-delivery-smoke.test.mjs \
  lib/server/orchestration/external-delivery.test.ts

npm run typecheck --workspace @founderos/web

cd /Users/martin/infinity/apps/shell/apps/web && \
npx vitest run scripts/external-delivery-smoke.test.mjs \
  components/orchestration/delivery-summary.test.tsx \
  components/execution/primary-run-surface.test.tsx \
  lib/server/orchestration/delivery-state.test.ts \
  lib/delivery-readiness.test.ts \
  lib/server/orchestration/autonomous-run.test.ts \
  lib/server/orchestration/claude-design-presentation.test.ts \
  lib/server/orchestration/artifacts.test.ts \
  lib/server/orchestration/external-delivery.test.ts \
  lib/server/orchestration/external-delivery.live.test.ts \
  lib/server/orchestration/executor-adapters.test.ts \
  lib/server/control-plane/workspace/rollout-config.test.ts \
  app/api/control/deployment/boot-diagnostics/route.test.ts \
  app/api/control/orchestration/assembly/route.test.ts \
  app/api/control/orchestration/verification/route.test.ts \
  app/api/control/orchestration/delivery/route.test.ts \
  'app/api/control/orchestration/continuity/[initiativeId]/route.test.ts' \
  'app/(shell)/execution/delivery/[deliveryId]/page.test.tsx' \
  'app/(shell)/execution/deliveries/page.test.tsx' \
  'app/(shell)/execution/validation/page.test.tsx'

git diff --check
```

Result:

```text
Targeted smoke/provider tests: 2 passed / 1 skipped; 8 passed / 1 skipped.
Typecheck passed.
Focused suite: 20 test files, 19 passed / 1 skipped.
Focused suite: 86 tests, 85 passed / 1 skipped.
git diff --check passed.
`npm run test:external-delivery-smoke --workspace @founderos/web` failed
closed before live provider execution because
FOUNDEROS_EXTERNAL_DELIVERY_ALLOW_MUTATIONS=1 was not set.
```

## Critic Gates

Critic GO gates were received for:

- P0-BE-15 final artifact-store fix.
- P0-BE-14 live provider scaffold.
- P0-BE-14 PR idempotency increment.
- P0-BE-14 smoke harness after the local-artifact NO-GO fix.
- P0-BE-14 hosted preview payload increment.
- P0-BE-14 production-readiness runbook increment.

Latest critic after the signed-download live smoke fix and explicit mutation
guard returned `BLOCKER`, not `GO`: the local code slice is acceptable, but real
staging smoke still cannot pass until the Vercel API token can read the project,
the operator explicitly allows GitHub/Vercel mutations, and the smoke preserves
real PR, preview, CI, signed manifest, signed artifact, and external proof
evidence.

Latest critic after provider-error redaction also returned `BLOCKER`, not
`GO`: redaction and mutation guards are acceptable, but the required live
staging smoke is still externally blocked.

Final critic after replacing the fake static Vercel-token-like test literal
with a dynamic test value returned `BLOCKER`, not `GO`: no local code gap was
identified, and the remaining issue is still the external Vercel project/token
plus live smoke approval.

After adding the direct Vitest live-test mutation guard, targeted tests passed
with `9 passed / 1 skipped`, and the focused suite passed with
`86 passed / 1 skipped` out of `87`.
Critic for that direct-run guard returned `BLOCKER`, not `GO`: the guard is
accepted locally, but real staging evidence is still absent because Vercel
project discovery/token access and explicit mutation approval are unresolved.
Critic for the improved read-only discovery helper also returned `BLOCKER`,
not `GO`: direct project preflight is useful and accepted locally, but the
configured token still receives Vercel `404 Project not found` for
`prj_vhshLn5INcinxWrSaSUbws6FImPf`.

After adding regression coverage for the discovery helper:

```text
scripts/external-delivery-vercel-discover.test.mjs: 4 passed.
Focused suite: 21 test files, 20 passed / 1 skipped.
Focused suite: 91 tests, 90 passed / 1 skipped.
Typecheck passed.
git diff --check passed.
Tracked-source token-pattern scan passed.
```
Critic for the discovery regression tests returned `BLOCKER`, not `GO`: test
coverage is accepted locally, but real PR/preview/CI/signed-artifact evidence is
still missing until Vercel discovery is green and live smoke is explicitly
allowed.
The helper now also tries direct configured-project preflight when
repo-linked project search itself fails, so a token that can read the configured
project can still be diagnosed even if project listing/search is restricted.
Critic for that fallback returned `BLOCKER`, not `GO`: the helper is accepted
as a diagnostic improvement, but the real configured project still returns
Vercel `404 Project not found` with the current token.

After adding `external-delivery:preflight`:

```text
Targeted preflight/discovery/smoke/provider tests: 16 passed / 1 skipped.
`npm run external-delivery:preflight --workspace @founderos/web` fails closed
at read-only Vercel discovery with the current token/project 404.
Preflight tests verify discovery failures are reported before mutation
confirmation, so a bad token/project is not masked by the mutation guard.
```
Critic for the preflight entrypoint returned `BLOCKER`, not `GO`: the new
preflight is accepted locally, but it is only a gate and does not replace the
required real staging smoke evidence.
Critic for the preflight error-ordering regression returned `BLOCKER`, not
`GO`: the ordering test is accepted locally, but Vercel discovery still fails
with the current token/project and no live staging proof exists.
After checking the Vercel REST docs for project endpoints, the local code path
was rechecked against the documented `teamId`/`slug` team-scope query
parameters. A regression test now verifies
`FOUNDEROS_VERCEL_TEAM_SLUG=ls-projects-adb8778b` is propagated as `slug` on
both `/v10/projects` repo search and `/v9/projects/{idOrName}` direct project
preflight. Targeted tests passed:
`external-delivery-vercel-discover.test.mjs`,
`external-delivery-preflight.test.mjs`, and `external-delivery.test.ts`
reported `14 passed`. `npm run typecheck --workspace @founderos/web` also
passed after this regression. The full focused P0-BE-13/14/15 suite was rerun
after the regression and passed with `21 passed / 1 skipped` files and
`94 passed / 1 skipped` tests; the skipped file is the guarded live smoke.
The Vercel discovery error now also prints an explicit workspace-token hint
when the project exists in the UI but direct REST preflight cannot read it:
create the API token in the same personal/team workspace that owns the project.
Regression coverage for that diagnostic passed with the preflight/discovery
script tests (`8 passed`). Independent critic for this diagnostic slice returned
`BLOCKER` overall, with the diagnostic slice accepted locally and full P0-BE-14
still blocked on real Vercel project access plus explicit live-mutation approval.
Discovery now also performs read-only access diagnostics after a direct project
preflight failure. With the current token it reports: scoped project listing
`0`, personal project listing `0`, and team listing `403 forbidden`. This
confirms the token can authenticate but is not scoped to a workspace that can
read `infinity-web`. Independent critic accepted this access-diagnostics slice
locally and kept full P0-BE-14 at `BLOCKER`. After this slice,
`npm run typecheck --workspace @founderos/web` passed and the full focused suite
passed again with `21 passed / 1 skipped` files and `94 passed / 1 skipped`
tests.
The preflight command now also performs read-only GitHub repo/base-branch access
checks before Vercel discovery. With the current env it prints
`GitHub preflight passed for MartinCampbell1/infinity master`, then fails at the
same Vercel project-visibility blocker. After this GitHub preflight slice,
`npm run typecheck --workspace @founderos/web` passed and the full focused suite
passed with `21 passed / 1 skipped` files and `98 passed / 1 skipped` tests.
Additional preflight regressions now cover explicit no-push GitHub tokens and a
missing configured base branch; the preflight stops before Vercel discovery in
both cases. A later regression also covers invalid
`FOUNDEROS_GITHUB_REPOSITORY` format before any provider request. Independent
critic returned `GO` for this regression-test slice before the final format-test
addition, and a follow-up critic returned `GO` for the final format-test slice.
Branch-failure coverage also verifies token-like values are redacted in GitHub
base-branch errors; targeted preflight/discovery tests still pass with
`12 passed`. Independent critic returned `BLOCKER` overall for this check, with
the local branch-error-redaction slice accepted and full P0-BE-14 still blocked
by external Vercel access.
The preflight command now requires explicit `FOUNDEROS_DEPLOYMENT_ENV=staging`
instead of defaulting a missing value to staging. Regression coverage verifies a
missing deployment env fails before any provider request; targeted script tests
passed with `16 passed`. The smoke launcher now enforces the same explicit
deployment env requirement before provider smoke starts; targeted script tests
passed with `17 passed`. `npm run typecheck --workspace @founderos/web` passed,
and the focused suite passed with `21 passed / 1 skipped` files and
`100 passed / 1 skipped` tests. Independent critic returned `GO` for this
explicit-env gate. Independent critic for the smoke launcher alignment returned
`BLOCKER` overall, with the local launcher explicit-env slice accepted and full
P0-BE-14 still blocked by external Vercel access.
`npm run test:external-delivery-smoke --workspace @founderos/web` was rerun
without `FOUNDEROS_EXTERNAL_DELIVERY_ALLOW_MUTATIONS=1` and failed closed at the
mutation guard before starting live provider smoke.
Preflight and smoke launcher now also reject local/non-HTTPS
`FOUNDEROS_ARTIFACT_SIGNED_URL_BASE` values before provider calls or provider
smoke. The current env passes this guard and still fails at the Vercel
project-visibility blocker. Targeted script tests passed with `19 passed`,
`npm run typecheck --workspace @founderos/web` passed, and the focused suite
passed with `21 passed / 1 skipped` files and `102 passed / 1 skipped` tests.
Independent critic returned `GO` for this signed-url-base fail-fast slice.
Preflight and smoke launcher now also reject local
`FOUNDEROS_ARTIFACT_STORAGE_URI_PREFIX` values and store-mode/prefix scheme
mismatches before provider work. The current env passes these guards and still
fails at the Vercel project-visibility blocker. Targeted script tests passed
with `23 passed`, `npm run typecheck --workspace @founderos/web` passed, and
the focused suite passed with `21 passed / 1 skipped` files and
`106 passed / 1 skipped` tests. Independent critic returned `GO` for this
storage-uri-prefix fail-fast slice.
Preflight and smoke launcher now also reject
`FOUNDEROS_ARTIFACT_OBJECT_MIRROR_ROOT` values under `/Users` before provider
work. The current env passes this guard and still fails at the Vercel
project-visibility blocker. Targeted script tests passed with `25 passed`,
`npm run typecheck --workspace @founderos/web` passed, and the focused suite
passed with `21 passed / 1 skipped` files and `108 passed / 1 skipped` tests.
Independent critic returned `BLOCKER` overall for this check, with the local
mirror-root gate accepted and full P0-BE-14 still blocked by external Vercel
access.
Preflight and smoke launcher now also reject `0.0.0.0` as a signed artifact
download base, matching the shared artifact-store local-host policy. Regression
coverage uses `https://0.0.0.0/...` so the failure is host-locality, not a
plain non-HTTPS rejection. After this parity slice:

```text
Targeted script tests: 3 files passed, 27 tests passed.
Read-only preflight: GitHub passed, then the known Vercel project-access
blocker remained.
Typecheck passed.
Focused suite: 21 passed / 1 skipped files, 110 passed / 1 skipped tests.
```
Independent critic returned `BLOCKER` overall for this parity slice, with the
local `0.0.0.0` signed-url-base guard accepted and full P0-BE-14 still blocked
by missing real staging PR, hosted preview, CI, signed manifest, signed artifact,
and external proof evidence.
The GitHub/Vercel external delivery provider and live-smoke evidence helpers now
also treat `0.0.0.0` as local-only content. Hosted preview HTML containing
`https://0.0.0.0/...` is rejected before provider mutations, and live-smoke
artifact URI/body leak checks now reject `0.0.0.0` alongside `localhost`,
`127.0.0.1`, `file://`, and `/Users/`. After this provider/live-smoke evidence
parity slice:

```text
Targeted provider/script tests: 3 passed / 1 skipped files,
29 passed / 1 skipped tests.
Typecheck passed.
Focused suite: 21 passed / 1 skipped files, 111 passed / 1 skipped tests.
Read-only preflight: GitHub passed, then the known Vercel project-access
blocker remained.
```
Independent critic returned `BLOCKER` overall for this provider/live-smoke
parity slice, with no local code fix required for the `0.0.0.0` guard. Full
P0-BE-14 remains blocked by missing real staging PR, hosted preview, CI, signed
manifest, signed artifact, and external proof evidence.
An additional artifact-byte leak regression caught that the object-store
delivery manifest still contained `launchProofUrl: http://127.0.0.1...` and a
`localhostReady` field name. Non-local delivery manifests now preserve the proof
state as `localRunnableProofReady` and `launchProofKind/At`, but omit the local
launch URL. Object-mode artifact byte sanitization also redacts localhost,
`127.0.0.1`, and `0.0.0.0` URLs/hostnames in uploaded delivery artifacts.
Regression assertions now download signed artifacts and read proof/delivery
manifests to confirm they do not contain `file://`, localhost, `127.0.0.1`,
`0.0.0.0`, the object mirror root, temp state dir, or `/Users/martin/`. After
this manifest/artifact-byte leak fix:

```text
Targeted delivery/artifact/provider/script tests: 5 passed / 1 skipped files,
52 passed / 1 skipped tests.
Typecheck passed.
Focused suite: 21 passed / 1 skipped files, 111 passed / 1 skipped tests.
Read-only preflight: GitHub passed, then the known Vercel project-access
blocker remained.
```
Independent critic returned `GO` for this local GitHub-preflight slice and
confirmed full P0-BE-14 remains blocked externally by Vercel project access.
Vercel access-diagnostics tests also now cover redaction for provider errors
returned by the scoped/personal project listing and team-listing probes; the
focused suite still passes with `21 passed / 1 skipped` files and
`98 passed / 1 skipped` tests. Independent critic returned `GO` for this
diagnostics-redaction slice.
Fresh independent critic gate after the 2026-04-25 read-only probes also
returned `BLOCKER`, not `GO`: the local scaffold, guards, and test evidence are
accepted, but P0-BE-14 still lacks the required real PR, hosted preview, CI
proof, signed manifest, signed artifact download evidence, and external proof
manifest because Vercel API project access is not working and mutating live
smoke has not been explicitly approved.

## Current Blocker

Full P0-BE-14 is not complete yet.

Current live setup status:

- GitHub repo is public: `MartinCampbell1/infinity`.
- Vercel GitHub App was installed for only `MartinCampbell1/infinity`.
- Vercel project `infinity-web` was created through the Vercel UI with root
  directory `apps/shell/apps/web`.
- Initial Vercel deployment URL shown by the UI:
  `infinity-web-iota.vercel.app`.
- Project settings show project ID:
  `prj_vhshLn5INcinxWrSaSUbws6FImPf`.
- The team/workspace URL slug is `ls-projects-adb8778b`; the code now supports
  this as `FOUNDEROS_VERCEL_TEAM_SLUG` and sends it to Vercel API requests as
  the documented `slug` query parameter.
- The currently configured `FOUNDEROS_VERCEL_TOKEN` can authenticate as the
  Vercel user but cannot read the created project/deployment through the Vercel
  REST API and cannot create projects (`project:create` forbidden).
- Fresh read-only probes on 2026-04-25 showed the configured env file is ignored
  by git and contains the expected provider keys, but Vercel still exposes no
  usable project access: `GET /v2/teams` returns `403 forbidden`, team-scoped
  project listing returns `0` projects, personal project listing returns `0`
  projects, and direct reads for `prj_vhshLn5INcinxWrSaSUbws6FImPf` return
  `404 Project not found` with and without `FOUNDEROS_VERCEL_TEAM_SLUG`.
- Fresh read-only GitHub probes with the configured GitHub token succeed:
  `MartinCampbell1/infinity` is readable, `master` is readable, and repo
  permissions include `push`. This is now covered by the standard preflight
  command, which prints `GitHub preflight passed for MartinCampbell1/infinity
  master` before the Vercel blocker.
- Direct read probes with the configured token still return no access:
  `/v10/projects?slug=ls-projects-adb8778b` returns zero projects, and direct
  project reads for `prj_vhshLn5INcinxWrSaSUbws6FImPf` return `404 Project not
  found`.
- A fresh read-only
  `npm run external-delivery:vercel-discover --workspace @founderos/web` after
  the signed-download smoke fix still fails with no Vercel project linked to
  `MartinCampbell1/infinity` / repo id `1215507602`.
- The same read-only discovery command was rerun after the independent critic
  gate and still fails before any mutation: no project linked to
  `MartinCampbell1/infinity` / repo id `1215507602`, and direct preflight for
  `prj_vhshLn5INcinxWrSaSUbws6FImPf` returns Vercel `404 Project not found`.
- The latest read-only discovery output also includes access diagnostics:
  scoped project listing returns `0` projects, personal project listing returns
  `0` projects, and team listing fails with `403 forbidden`.
- The discovery helper now also performs a direct read-only preflight for
  configured `FOUNDEROS_VERCEL_PROJECT_ID` when repo-linked project search is
  empty. With the current token, direct preflight for
  `prj_vhshLn5INcinxWrSaSUbws6FImPf` also returns Vercel `404 Project not
  found`, which confirms the token cannot read the UI-created project through
  the REST API.
- Safari is on `https://vercel.com/account/settings/tokens` with a prepared
  token form:
  `TOKEN NAME=infinity-external-delivery-staging`, `SCOPE=l's projects`,
  `EXPIRATION=1 Year`. `Create` has not been clicked because creating a
  persistent API token requires explicit operator confirmation.
- Read-only GitHub checks show no repo-local `.github/workflows`, but the
  public `master` commit has a successful `Vercel` commit status. If live smoke
  reaches CI proof, the proof source is expected to be a GitHub combined commit
  status from Vercel rather than a GitHub Actions workflow run.

The remaining blocker is external credential scope:

- provide a Vercel API token scoped to the account/team that owns
  `infinity-web`, with project/deployment read and preview deployment create
  access;
- rerun `npm run external-delivery:vercel-discover --workspace @founderos/web`
  to prove the token can see the project through the REST API;
- run `npm run test:external-delivery-smoke --workspace @founderos/web`;
- preserve the resulting PR URL, hosted preview URL, CI proof URI, signed
  manifest URI, signed artifact evidence, and external proof manifest URI.

Do not start the next audit step until this live staging smoke either passes or
is explicitly marked as a user-accepted BLOCKER.

## 2026-04-25 Live Credential Update

The operator approved creating a new Vercel API token. A token named
`infinity-external-delivery-staging` was created in the `l's projects`
workspace, copied once into the ignored
`/Users/martin/infinity/.env.external-delivery-staging`, and the clipboard was
cleared. The token value was not committed or printed by the shell update step.

After this token update:

```text
FOUNDEROS_EXTERNAL_DELIVERY_ALLOW_MUTATIONS=1 npm run external-delivery:preflight --workspace @founderos/web
```

passed GitHub and Vercel project discovery:

```text
GitHub preflight passed for MartinCampbell1/infinity master.
Found 1 Vercel project candidate:
name: infinity-web
id: prj_vhshLn5INcinxWrSaSUbws6FImPf
rootDirectory: apps/shell/apps/web
repoId: 1215507602
external delivery preflight passed; live smoke is allowed to run.
```

The first live smoke attempt then failed before GitHub/Vercel delivery
mutations:

```text
FOUNDEROS_EXTERNAL_DELIVERY_ALLOW_MUTATIONS=1 npm run test:external-delivery-smoke --workspace @founderos/web
```

failed while downloading the signed manifest because the hosted signed-download
route returned `404`. Direct route probes confirmed:

```text
https://infinity-web-iota.vercel.app/api/control/orchestration/artifacts/download -> 404
https://infinity-web.vercel.app/api/control/orchestration/artifacts/download -> 404
```

This means the public hosted app does not yet contain the new
`/api/control/orchestration/artifacts/download` route from this audit branch.
To make the blocker explicit, preflight and smoke launcher now probe
`FOUNDEROS_ARTIFACT_SIGNED_URL_BASE` with a dummy signed-artifact request and
fail before provider smoke if the hosted route returns `404`.

The current audit tree was committed and pushed to a dedicated staging-smoke
branch so Vercel could build a preview with the route:

```text
branch: codex/p0-be-14-staging-smoke
commit: current pushed branch head, `Harden strict delivery artifact evidence`
preview deployment: infinity-b7fmlmiog-ls-projects-adb8778b.vercel.app
deployment id: dpl_6Bf4LmVgWZis7J5V9xGGnQtzRjzo
state: READY
```

That preview route exists behind Vercel Deployment Protection and returns `401`
without a protection bypass secret. Therefore the remaining blocker is no
longer Vercel API token scope; it is hosted artifact-route availability for
automation:

- deploy the artifact download route to the public `FOUNDEROS_ARTIFACT_SIGNED_URL_BASE`, or
- configure a Vercel Protection Bypass for Automation and set
  `FOUNDEROS_VERCEL_PROTECTION_BYPASS_SECRET`; the smoke/preflight/live test now
  send it as `x-vercel-protection-bypass` for route, signed artifact, and
  preview fetches, and
- configure a real object storage backend, or otherwise make the hosted
  artifact route able to read the signed artifacts after deploy.

The launcher now treats a dummy signed-download probe as valid only when the
hosted route returns the app-level `403` JSON `artifact_unavailable` response.
It fails on platform `404`, protected `401`, and non-route HTML responses. It
also rejects staging object mirror roots under `/tmp`, `/var/tmp`,
`/var/folders`, or `/Users`, because those local scratch paths cannot satisfy
the "downloadable after restart/deploy" criterion from a hosted Vercel runtime.

Until that route and storage are available from the hosted runtime, full
P0-BE-14 remains `BLOCKER` even though GitHub/Vercel API credentials now pass.

## 2026-04-25 Protected Route and Scratch Storage Guard

After the preview route proved to be protected, the local guard slice was
tightened again:

- preflight and smoke send `FOUNDEROS_VERCEL_PROTECTION_BYPASS_SECRET` or
  `VERCEL_AUTOMATION_BYPASS_SECRET` as `x-vercel-protection-bypass`;
- the live smoke uses the same header for signed artifact downloads and preview
  fetches;
- route probing now accepts only the shell route's expected `403` JSON
  `artifact_unavailable` response to a dummy invalid signature;
- route probing fails closed on protected `401`, platform `404`, server `5xx`,
  or non-route HTML responses;
- production-like artifact config rejects temp/scratch mirror roots under
  `/tmp`, `/private/tmp`, `/var/tmp`, `/var/folders`, and `/Users`.

Verification for this slice:

```text
npm run typecheck --workspace @founderos/web
# passed

cd /Users/martin/infinity/apps/shell/apps/web
npx vitest run lib/server/orchestration/artifacts.test.ts app/api/control/orchestration/delivery/route.test.ts lib/server/control-plane/workspace/rollout-config.test.ts app/api/control/deployment/boot-diagnostics/route.test.ts components/orchestration/delivery-summary.test.tsx scripts/external-delivery-preflight.test.mjs scripts/external-delivery-smoke.test.mjs scripts/external-delivery-vercel-discover.test.mjs lib/server/orchestration/external-delivery.live.test.ts
# 8 passed / 1 skipped files, 80 passed / 1 skipped tests

npx vitest run components/orchestration/delivery-summary.test.tsx components/execution/primary-run-surface.test.tsx lib/server/orchestration/delivery-state.test.ts lib/delivery-readiness.test.ts lib/server/orchestration/autonomous-run.test.ts lib/server/orchestration/claude-design-presentation.test.ts lib/server/orchestration/artifacts.test.ts lib/server/orchestration/executor-adapters.test.ts lib/server/control-plane/workspace/rollout-config.test.ts app/api/control/deployment/boot-diagnostics/route.test.ts app/api/control/orchestration/assembly/route.test.ts app/api/control/orchestration/verification/route.test.ts app/api/control/orchestration/delivery/route.test.ts 'app/api/control/orchestration/continuity/[initiativeId]/route.test.ts' 'app/(shell)/execution/delivery/[deliveryId]/page.test.tsx' 'app/(shell)/execution/deliveries/page.test.tsx' 'app/(shell)/execution/validation/page.test.tsx' scripts/external-delivery-preflight.test.mjs scripts/external-delivery-smoke.test.mjs scripts/external-delivery-vercel-discover.test.mjs
# 20 files / 113 tests passed

git diff --check
# passed
```

The current ignored staging env still uses:

```text
FOUNDEROS_ARTIFACT_OBJECT_MIRROR_ROOT=/tmp/infinity-artifact-mirror
```

so both live entrypoints now fail before provider requests:

```text
npm run external-delivery:preflight --workspace @founderos/web
FOUNDEROS_EXTERNAL_DELIVERY_ALLOW_MUTATIONS=1 npm run test:external-delivery-smoke --workspace @founderos/web
# both fail on the hosted-readable durable artifact mount guard
```

Independent critic gate `critic_p0_be_14_protection_storage_guard` returned
`GO` for this local guard slice and `BLOCKER` for overall P0-BE-14 until the
hosted route/storage path is real and the mutating smoke produces external PR,
preview, CI, signed object manifest, and artifact download evidence.

## 2026-04-25 Vercel Blob Backend Slice

The next local slice replaced the staging-only object mirror requirement with a
real hosted-readable backend for Vercel staging:

- `FOUNDEROS_ARTIFACT_OBJECT_BACKEND=vercel_blob` selects a private Vercel Blob
  artifact backend;
- the backend uses `@vercel/blob` with `BLOB_READ_WRITE_TOKEN` or
  `FOUNDEROS_VERCEL_BLOB_READ_WRITE_TOKEN`;
- artifact uploads no longer require `FOUNDEROS_ARTIFACT_OBJECT_MIRROR_ROOT`
  when the Vercel Blob backend is configured;
- signed artifact downloads read bytes back through the deployed app route and
  verify the signed URL HMAC plus SHA256 checksum;
- `/api/control/orchestration/artifacts/download` is exempted from
  control-plane actor auth in the proxy because the expiring signed artifact URL
  is the artifact authorization boundary. Browser CORS restrictions still apply.

Local staging resources created:

```text
Vercel project: infinity-web
linked Blob store: infinity-artifacts-staging-web
local ignored env: .env.external-delivery-staging
```

No secrets are committed. The Vercel link metadata and pulled env files remain
ignored under `apps/shell/apps/web/.vercel` and `apps/shell/apps/web/.env*.local`.

Verification so far for this slice:

```text
cd /Users/martin/infinity/apps/shell/apps/web
npx vitest run proxy.test.ts lib/server/orchestration/artifacts.test.ts app/api/control/orchestration/delivery/route.test.ts --testTimeout 120000
# 3 files / 29 tests passed
```

The latest protected preview route could be reached with the automation bypass,
but the old deployed code still answered before this proxy exemption was pushed.
Next steps:

1. run typecheck, focused script/config tests, and `git diff --check`;
2. run an independent critic gate for this Blob/proxy slice;
3. commit and push the branch so Vercel builds a preview with the Blob backend
   and signed-download proxy exemption;
4. set `FOUNDEROS_ARTIFACT_SIGNED_URL_BASE` in the ignored staging env to that
   new preview route;
5. rerun `npm run external-delivery:preflight --workspace @founderos/web`, then
   the mutating smoke with `FOUNDEROS_EXTERNAL_DELIVERY_ALLOW_MUTATIONS=1`.
