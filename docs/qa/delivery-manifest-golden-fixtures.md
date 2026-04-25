# Delivery manifest golden fixtures

`P2-QA-03` protects generated delivery manifest compatibility with golden
fixtures for the two supported delivery shapes:

- local solo handoff:
  `apps/shell/apps/web/lib/server/orchestration/fixtures/delivery-manifests/local.json`
- production/object-store handoff:
  `apps/shell/apps/web/lib/server/orchestration/fixtures/delivery-manifests/production.json`

The focused test is:

```bash
cd /Users/martin/infinity
npm run shell:test:delivery-manifests
```

The full artifact manifest test file is also cheap enough to run:

```bash
cd /Users/martin/infinity/apps/shell/apps/web
npx vitest run lib/server/orchestration/artifacts.test.ts
```

Do not update these fixtures as a mechanical snapshot refresh. A fixture change
means the delivery manifest contract changed and should be reviewed with the
corresponding local or production delivery behavior.
