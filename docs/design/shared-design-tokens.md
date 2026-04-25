# Shared Design Tokens

`P2-FE-01` establishes the first shared token layer between the FounderOS shell
and the embedded work-ui surface.

Source of truth:

- `packages/ui/src/styles/tokens.css`
- exported as `@founderos/ui/tokens.css`
- included by `@founderos/ui/globals.css`

Current token groups:

- typography: font family, scale, and line-height tokens
- spacing: `--space-1` through `--space-11`
- radius: control, pill, card, runtime-card, and hero radii
- status colors: running, planning, pending, failed, and neutral states
- transitions: base and fade timing

Current reuse:

- shell imports `@founderos/ui/globals.css`, which includes the shared tokens
- work-ui imports `@founderos/ui/tokens.css`
- `EmbeddedMetaStrip.svelte` uses shared spacing, radius, typography, mono font,
  and status color tokens

Guard:

```bash
cd /Users/martin/infinity
npm run qa:shared-design-tokens
```

Keep this layer conservative. Add tokens when shell and work-ui both have a
reason to share them; avoid turning it into a full redesign or a replacement for
Open WebUI visual identity.
