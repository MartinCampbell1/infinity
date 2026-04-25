# Critical Coverage Gate

`P2-QA-01` adds a CI gate for critical module coverage before introducing heavier line/branch instrumentation.

The gate is intentionally small and fail-closed:

- command: `npm run qa:critical-coverage`
- self-test: `npm run qa:critical-coverage:test`
- CI workflow: `.github/workflows/critical-coverage.yml`

## Thresholds

The current threshold is 100% module coverage for each critical area:

- `control-plane-auth`
- `control-plane-state`
- `delivery`
- `kernel-scheduler`

Each covered module must have:

1. every declared source file present;
2. every declared test file present;
3. at least one test signal in each declared test file.

The test signal check accepts common JavaScript/TypeScript test calls and Go `func Test...` declarations.

## Why This Shape

The repo does not currently include a Vitest coverage provider such as `@vitest/coverage-v8`, and the Go kernel has a `go 1.26.0` toolchain requirement that can be expensive on a constrained local machine. This gate therefore protects the critical auth/state/delivery/kernel-scheduler test map in CI without adding a heavier coverage dependency or forcing a full runtime test pass on every local bounded step.

This is not a replacement for future line or branch coverage. It is a first fail-closed threshold: if a critical source module loses its matching tests, CI fails.
