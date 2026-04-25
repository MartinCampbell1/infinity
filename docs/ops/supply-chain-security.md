# Supply Chain Security

The supply-chain CI gate has two responsibilities:

1. Generate a CycloneDX SBOM from `package-lock.json`.
2. Fail the build when `npm audit` reports any critical vulnerability.

## Local Commands

From `/Users/martin/infinity`:

```bash
npm run security:sbom -- --output /tmp/infinity-sbom.cdx.json
npm run security:audit:critical
```

The SBOM generator is lockfile-based so CI can produce a deterministic artifact without starting app runtimes or browser processes.

## CI

`.github/workflows/supply-chain-security.yml` runs on pull requests and pushes to `main`/`master`.

The workflow:

- installs dependencies with `npm ci`;
- writes `artifacts/security/infinity-sbom.cdx.json`;
- runs the critical vulnerability gate;
- uploads the SBOM artifact even when the audit step fails.

## Current Critical Vulnerability Policy

Critical vulnerabilities are release blockers. High, moderate, low, and info advisories remain visible in the npm audit report, but this P2 gate blocks only critical findings.
