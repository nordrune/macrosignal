# web

## Purpose

SvelteKit 2 dashboard (Svelte 5 runes, TypeScript strict). Bun toolchain. Served via `svelte-adapter-bun` in prod.

## Ownership

| Path                                   | Role                                      |
| -------------------------------------- | ----------------------------------------- |
| `src/routes/+page.svelte`              | Main dashboard                            |
| `src/routes/+layout.svelte`            | Shell, i18n context, dark theme           |
| `src/hooks.server.ts`                  | Prod `/api` + `/health` proxy to Litestar |
| `src/lib/api.ts`                       | Typed fetch client (matches Python DTOs)  |
| `src/lib/i18n/context.svelte.ts`       | `createContext` i18n (not module store)   |
| `src/lib/components/PriceChart.svelte` | Canvas charts (ponytail: not Recharts)    |
| `vite.config.ts`                       | Dev proxy to `API_ORIGIN`                 |

## Local contracts

- Strict TypeScript (`tsconfig.json` strict: true)
- Svelte 5 runes: `$state`, `$derived`, `$props`; avoid `$effect` except canvas/DOM sync
- i18n via `getI18n()` from layout context — no global writable store
- API JSON field names must match `trading_backtester/dto.py`
- Lint/format: **Oxc stack** (`oxlint`, `oxfmt`) — not ESLint/Prettier
- Types: `svelte-check` via `bun run typecheck`

## Work guidance

- shadcn UI in `src/lib/components/ui/` is generated — ignore in oxlint
- Select components use `{#snippet child({ props })}` (bits-ui WithoutChild)
- `$state.raw` for API response objects (reassigned, not mutated)

## Verification

```bash
cd web && bun run qa          # oxfmt --check, oxlint, svelte-check
cd web && bun run qa:fix      # auto-fix format + lint
devenv tasks run qa:web:lint
```

## Child DOX Index

(none)
