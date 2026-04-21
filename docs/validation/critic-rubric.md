# Critic Rubric

The critic evaluates the product from screenshots and interaction evidence only.

## Primary baseline

The primary benchmark is:

- **FounderOS / Linear fit**

This means the critic should reward:

- calm, scan-friendly information hierarchy
- shell/operator clarity
- explicit next-step CTA
- consistent density and status carding
- coherent split between shell and embedded workspace

The critic should penalize:

- generic dashboard drift
- buried operator actions
- unclear next-step guidance
- uneven density
- broken or misleading blocked states
- visual mismatch between shell and work-ui

## Score weights

- `entry_and_navigation`: 20%
- `user_flow`: 25%
- `operator_flow`: 20%
- `error_states`: 15%
- `visual_consistency`: 20%

## Pass threshold

The run passes only if:

- `overall_score > 7.0`
- every core cluster is `>= 6.5`
- there are no unresolved `must_fix` findings

## Expected output

The critic must return:

- `overall_score`
- `cluster_scores`
- `findings`
- `pass`

Each finding should include:

- `severity`
- `screen_id`
- `problem`
- `why_it_hurts`
- `required_fix`
