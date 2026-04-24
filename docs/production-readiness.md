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
