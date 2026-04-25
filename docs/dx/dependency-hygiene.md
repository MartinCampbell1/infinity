# Dependency Hygiene

P2-DX-02 keeps the monorepo dependency state reproducible for local agents,
archives, and CI.

## Package Manager

Use the package manager pinned in the root `package.json`:

```text
npm@10.9.4
```

Do not switch package managers inside this repo. Do not add `pnpm-lock.yaml`,
`yarn.lock`, or nested workspace lockfiles.

## Install Command

Use the lockfile-enforced install path from the repository root:

```sh
npm ci
```

The root setup script is the same reproducible command:

```sh
npm run setup
```

## Lockfile Policy

`package-lock.json` is the checked lockfile for the whole workspace. Treat it as
the dependency source of truth alongside root `package.json`.

If dependency manifests intentionally change, refresh the lockfile from the
repository root:

```sh
npm run setup:refresh-lockfile
```

Then verify the lockfile can still drive a clean install:

```sh
npm ci --ignore-scripts --dry-run
```

Do not edit `package-lock.json` by hand.
