# raw/codex-app-server-rate-limits

Store raw rate-limit request and response captures here.

Minimum coverage:

- `account/rateLimits/read`
- `account/rateLimits/updated`
- healthy account;
- high-pressure account;
- exhausted account;
- auth-mode difference when available.

Naming guidance:

- `read-<scenario>.json` for synchronous account/rateLimits/read snapshots
- `updated-<scenario>.ndjson` for account/rateLimits/updated event streams
- include one API-key observed-runtime example to validate non-ChatGPT semantics
