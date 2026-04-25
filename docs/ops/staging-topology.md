# Staging Topology Contract

`P1-OPS-01` staging is treated as a production-like topology gate, not a
localhost preview. The boot diagnostics API exposes
`stagingTopology.ready`; production promotion should not proceed until it is
true.

Required boundaries:

- Public shell URL: `FOUNDEROS_SHELL_PUBLIC_ORIGIN` must be a non-local HTTPS
  origin.
- Separate work-ui: `FOUNDEROS_WORK_UI_BASE_URL` must be a non-local HTTPS
  origin and must not share the shell origin.
- Private execution kernel: `FOUNDEROS_EXECUTION_KERNEL_BASE_URL` must point to
  a private service endpoint such as `.internal`, `.private`, `.svc`,
  `.cluster.local`, or an RFC1918 address. It must not appear in
  `FOUNDEROS_PRIVILEGED_API_ALLOWED_ORIGINS`.
- Postgres: `FOUNDEROS_CONTROL_PLANE_DATABASE_URL` or
  `FOUNDEROS_EXECUTION_HANDOFF_DATABASE_URL` must be a Postgres URL.
- Object storage: artifact storage must be non-local and include a signed URL
  base plus signing secret.
- Secrets manager: `FOUNDEROS_SECRETS_MANAGER` must name the staging secret
  provider, for example `vercel`, `aws_secrets_manager`,
  `gcp_secret_manager`, `doppler`, `onepassword`, `vault`, or `infisical`.

Primary check:

```sh
curl -fsS "$FOUNDEROS_SHELL_PUBLIC_ORIGIN/api/control/deployment/boot-diagnostics" \
  | jq '.stagingTopology'
```

The response is designed to expose topology status and configured key names
without returning secret values.
