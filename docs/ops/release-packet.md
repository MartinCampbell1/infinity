# Release Packet Automation

`P2-OPS-02` adds a lightweight release packet generator. It reads an existing
validation packet and produces Markdown plus JSON release evidence without
starting app runtimes, browser automation, or dev servers.

## Local Command

From `/Users/martin/infinity`:

```bash
npm run release:packet -- --output-dir /tmp/infinity-release-packet
```

By default, the generator reads the latest directory under
`handoff-packets/validation/`. Use `--validation-dir` to point at a specific
validation packet.

## Output

The output directory contains:

- `release-packet.md`
- `release-packet.json`

Both files include:

- current Git commit, branch, subject, and dirty worktree count;
- validation status and release readiness;
- repo/browser/critic/check statuses;
- artifact paths from the validation packet;
- screenshot manifest entries with sensitive token query parameters redacted.
- the manual QA screenshot checklist path and required screenshot counts.

## CI

`.github/workflows/release-packet.yml` can generate and upload the packet as a
GitHub Actions artifact. It runs on manual dispatch and when release-packet or
tracked validation inputs change.
