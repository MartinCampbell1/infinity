# Developer Setup

This guide is for agents and developers working inside `/Users/martin/infinity`.
It covers the local toolchain, environment variables, common commands, and
troubleshooting paths for the current Infinity workspace.

## Repository Rules

- Work only inside `/Users/martin/infinity`.
- Treat `/Users/martin/FounderOS`, `/Users/martin/open-webui`,
  `/Users/martin/hermes-web-ui`, and external cabinet snapshots as read-only
  references.
- Editable product code lives under `apps/*` and `packages/*`.
- Do not start watchers, dev servers, browser automation, or full repo checks
  unless the current task explicitly needs them.
- Do not commit or paste secrets from `.env*`, shell history, screenshots, or
  local browser sessions.

## Toolchain

Required for normal repo work:

- Node.js 22.x. The current lockfile was refreshed with npm 10.x.
- npm 10.x via the root `packageManager`.
- Python 3 for validation scripts under `scripts/validation`.
- Go for the execution kernel under `services/execution-kernel`.
- Git.

Optional or task-specific:

- Postgres for migration drift/smoke checks.
- Playwright browser dependencies for full validation and browser E2E.
- GitHub, Vercel, and object-store credentials only for external delivery
  staging smoke.

Check local versions:

```bash
node --version
npm --version
python3 --version
go version
git --version
```

Install dependencies:

```bash
cd /Users/martin/infinity
npm ci
```

If `package.json` changes and the lockfile must be refreshed intentionally:

```bash
npm run setup:refresh-lockfile
```

## Environment

Local defaults are intentionally loopback-only:

| Variable | Default / purpose |
| --- | --- |
| `FOUNDEROS_WEB_HOST` | `127.0.0.1` for the shell |
| `FOUNDEROS_WEB_PORT` | `3737` for the shell |
| `WORK_UI_HOST` | `127.0.0.1` for work-ui |
| `WORK_UI_PORT` | `3101` for work-ui |
| `EXECUTION_KERNEL_HOST` | `127.0.0.1` for the execution kernel |
| `EXECUTION_KERNEL_PORT` | `8798` for the execution kernel |
| `FOUNDEROS_CONTROL_PLANE_STATE_DIR` | defaults to `.local-state/control-plane` in local launcher |
| `FOUNDEROS_SHELL_PUBLIC_ORIGIN` | shell origin passed to shell/work-ui |
| `FOUNDEROS_WORK_UI_BASE_URL` | work-ui origin consumed by shell |
| `FOUNDEROS_EXECUTION_KERNEL_BASE_URL` | execution-kernel origin consumed by shell |
| `FOUNDEROS_PRIVILEGED_API_ALLOWED_ORIGINS` | privileged API CORS boundary |
| `FOUNDEROS_MIGRATION_TEST_DATABASE_URL` | required for migration drift checks |

Local launcher secrets have development fallbacks in `scripts/start-localhost.mjs`.
Staging/production secrets must be supplied explicitly and must not be committed.

External delivery smoke uses an ignored env file by default:

```text
.env.external-delivery-staging
```

That path is ignored by `.gitignore`. Keep real `FOUNDEROS_GITHUB_*`,
`FOUNDEROS_VERCEL_*`, `FOUNDEROS_ARTIFACT_*`, and `BLOB_READ_WRITE_TOKEN`
values out of source files and handoffs.

## Common Commands

Install and setup:

```bash
npm ci
```

Start the local integrated stack only when needed:

```bash
npm run localhost:start
```

The local launcher starts shell, work-ui, and the execution kernel. Stop it with
`Ctrl-C` when the check is complete; do not leave background dev servers running.

Targeted shell checks:

```bash
npm run shell:typecheck
npm run test:security --workspace @founderos/web
npm run shell:control-plane:migrations:drift:test
```

Targeted work-ui checks:

```bash
npm run work-ui:check
npm run work-ui:test
```

Supply-chain and release packet checks:

```bash
npm run security:sbom -- --output /tmp/infinity-sbom.cdx.json
npm run security:audit:critical
npm run release:packet -- --output-dir /tmp/infinity-release-packet
```

Focused documentation checks:

```bash
npm run docs:dev-setup:test
npm run docs:operator-quickstart:test
npm run docs:operator-glossary:test
npm run docs:known-limitations:test
npm run docs:security-model:test
npm run docs:production-readiness:test
npm run docs:staging-topology:test
```

Validation commands:

```bash
npm run validate:quick
npm run validate:full
```

`validate:full` may start local services and browser automation. Use it only
when the task calls for full validation. Generated validation output belongs
under ignored `handoff-packets/validation/`.

Migration drift with a disposable Postgres database:

```bash
FOUNDEROS_MIGRATION_TEST_DATABASE_URL=postgres://founderos:founderos@127.0.0.1:5432/founderos_migration_test \
  npm run shell:control-plane:migrations:drift
```

External delivery staging smoke is mutating and requires explicit credentials:

```bash
npm run external-delivery:preflight --workspace @founderos/web
FOUNDEROS_EXTERNAL_DELIVERY_ALLOW_MUTATIONS=1 \
  npm run test:external-delivery-smoke --workspace @founderos/web
```

Use `docs/production-readiness.md` for the full external delivery env list and
readiness policy.

## Troubleshooting

### `npm ci` or `npm install` changes too much

Run:

```bash
git diff -- package.json package-lock.json
```

Only keep intentional dependency changes. Do not run `npm audit fix --force`
inside this repo without a dedicated dependency-upgrade task.

### Shell port or work-ui port is already in use

The validation runner can choose nearby fallback ports, but the manual launcher
uses configured ports. Check listeners:

```bash
lsof -nP -iTCP:3737 -sTCP:LISTEN
lsof -nP -iTCP:3101 -sTCP:LISTEN
lsof -nP -iTCP:8798 -sTCP:LISTEN
```

Stop only processes that belong to the current Infinity task.

### Migration drift fails immediately

Confirm `FOUNDEROS_MIGRATION_TEST_DATABASE_URL` is set and points to a database
that can be reset by the drift script. The drift gate intentionally fails closed
when the variable is missing.

### Full shell `npm test` fails on visual regression

Do not treat a broad visual-regression failure as proof that a narrow backend or
docs step failed. Record the exact failure and prefer focused checks for the
current bounded step unless the task explicitly asks for the full shell suite.

### Release packet says `not_final`

`npm run release:packet` reads existing validation evidence. If the latest
validation packet skipped browser E2E or has a pending critic, the generated
packet must report `not_final`. Run the full validation/critic loop before
claiming final release readiness.

### External delivery preflight cannot find Vercel project

Verify the token belongs to the Vercel personal/team workspace that owns
`FOUNDEROS_VERCEL_PROJECT_ID`. For team projects, set
`FOUNDEROS_VERCEL_TEAM_ID` or `FOUNDEROS_VERCEL_TEAM_SLUG`.

### Generated artifacts show up in `git status`

Expected generated paths are ignored:

- `artifacts/`
- `.local-state/`
- `handoff-packets/validation/`
- `handoff-packets/browser-e2e/`
- `handoff-packets/release/`

If a new generated path appears, either write to `/tmp` for local verification
or add a narrow ignore rule with a documented reason.
