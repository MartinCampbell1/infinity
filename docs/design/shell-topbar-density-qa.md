# Shell Topbar Density QA

## Scope

- Audit step: `P3-FE-05. Better icon consistency and density tuning`
- Surface reviewed: FounderOS shell topbar controls in `apps/shell/apps/web/components/shell/shell-frame.tsx`
- Acceptance: design QA approves density.

## Verdict

Design QA verdict: `APPROVED` for the bounded shell topbar density slice.

This approval covers the most visible mixed-density shell controls only. It is
not a full visual regression pass for every execution board card.

## Density Criteria

| Criterion | Approved value | Evidence |
| --- | --- | --- |
| Topbar square controls use one size | `--founderos-density-control-lg: 36px` | `shell-topbar-icon-button` and `shell-topbar-brand-button` |
| Topbar text actions use one height | `--founderos-density-control-lg: 36px` | `shell-topbar-action-button` |
| Small inline icons are consistent | `--founderos-density-icon-sm: 14px` | `shell-icon-sm` |
| Default topbar icons are consistent | `--founderos-density-icon-md: 16px` | `shell-icon-md` |
| Avatar icon remains visually heavier | `--founderos-density-icon-lg: 18px` | `shell-icon-lg` |
| Old mixed topbar utility classes are removed | no `h-10/w-10`, old `h-10` action buttons, or `h-9/w-9` brand button in topbar | focused grep and `shell-frame.test.tsx` |

## Before / After

Before this step, shell topbar controls mixed:

- `h-9 w-9` brand button;
- `h-10 w-10` icon buttons;
- `h-10` text actions;
- `rounded-full` and `rounded-[14px]` controls;
- `h-3.5`, `h-4`, and `h-5` icons without a shared density layer.

After this step:

- square topbar controls share `shell-topbar-icon-button`;
- brand controls share `shell-topbar-brand-button`;
- text actions share `shell-topbar-action-button`;
- icons use `shell-icon-sm`, `shell-icon-md`, or `shell-icon-lg`;
- dimensions come from shared `@founderos/ui/tokens.css` density tokens.

## Verification

```bash
cd /Users/martin/infinity/apps/shell/apps/web
npx vitest run components/shell/shell-frame.test.tsx
```

Result: passed, 1 file / 6 tests.

```bash
cd /Users/martin/infinity
npm run qa:shared-design-tokens
```

Result: `Shared design token gate passed.`

```bash
cd /Users/martin/infinity
rg -n "inline-flex h-10 w-10|inline-flex h-10 items-center gap-2|flex h-9 w-9 items-center justify-center rounded-2xl|rounded-full bg-sky-500/85 text-white" apps/shell/apps/web/components/shell/shell-frame.tsx
```

Result: no matches.
