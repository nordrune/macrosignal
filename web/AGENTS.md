# web

## Purpose

SvelteKit 2 dashboard (Svelte 5 runes, TypeScript strict). Bun toolchain. Served via `svelte-adapter-bun` in prod.

## Ownership

| Path                                                                      | Role                                                                   |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `src/routes/+page.svelte`                                                 | Main dashboard (settings, results; optimizer UI archived)              |
| `src/routes/+layout.svelte`                                               | Shell, i18n context, PWA meta (dark-only; no theme toggle)             |
| `src/app.html`                                                            | Fixed `class="dark"` shell                                             |
| `src/app.css`                                                             | Tokens, glass surfaces, skeleton, native-select styles                 |
| `src/hooks.server.ts`                                                     | Prod `/api` + `/health` proxy to Litestar                              |
| `src/lib/api.ts`                                                          | Typed fetch client (matches Python DTOs)                               |
| `src/lib/analytics.ts`                                                    | Client-side trade/fee/drawdown analytics                               |
| `src/lib/export.ts`                                                       | CSV/Excel/PDF export from run snapshot                                 |
| `src/lib/csv.ts`                                                          | CSV parse + sample fixture                                             |
| `src/lib/dashboard-state.ts`                                              | localStorage settings + last run cache                                 |
| `src/lib/theme.ts`                                                        | CSS var reader; chart/tone/SURFACE_CLASS/NATIVE_SELECT_CLASS; PWA meta |
| `src/lib/defaults.ts`                                                     | Default capital, fee, ticker suggestions                               |
| `src/lib/price-cache.ts`                                                  | Yahoo price cache (TTL + in-flight dedup)                              |
| `PeriodSelect.svelte` / `IntervalSelect.svelte` / `StrategySelect.svelte` | Native `<select>` wrappers                                             |
| `*Skeleton.svelte`, `RefreshOverlay.svelte`                               | Loading placeholders / in-flight overlay                               |
| `src/lib/components/AnalysisPanel.svelte`                                 | Post-run metrics cards                                                 |
| `src/lib/components/TradeInspector.svelte`                                | Selected trade detail panel                                            |
| `src/lib/components/ExportMenu.svelte`                                    | Export dropdown (passes `i18n` to export)                              |
| `src/lib/components/PriceChart.svelte`                                    | Canvas charts (ponytail: not Recharts)                                 |
| `static/site.webmanifest`, `pwa-icon-*.png`                               | Install manifest + static home-screen icons (no service worker)        |
| `src/lib/i18n/context.svelte.ts`                                          | `createContext` i18n (not module store)                                |
| `vite.config.ts`                                                          | Dev proxy to `API_ORIGIN`                                              |

## Local contracts

- Responsive layout: Tailwind `sm:` / `md:` / `lg:` breakpoints; tables scroll via shadcn `overflow-x-auto`
- Strict TypeScript (`tsconfig.json` strict: true)
- Svelte 5 runes: `$state`, `$derived`, `$props`; avoid `$effect` except canvas/DOM sync
- i18n via `getI18n()` from layout context, no global writable store; plain `.ts` modules (e.g. `export.ts`) must receive `I18nContext` from a component, never call `getI18n()` at click/runtime
- API JSON field names must match `trading_backtester/dto.py`
- Yahoo mode: `GET /api/ticker` once per symbol/period/interval (client cache), then `POST` with `prices[]`
- Lint/format: **Oxc stack** (`oxlint`, `oxfmt`), not ESLint/Prettier
- Types: `svelte-check` via `bun run typecheck`
- **Dark-only UI:** fixed dark; `src/app.html` `class="dark"`; tokens in `app.css` `:root`; no light mode / theme toggle
- **Typography:** `system-ui` in `app.css`; no webfonts
- **Colors:** define in `src/app.css` `:root`; UI uses Tailwind (`text-positive`, `bg-primary`); canvas uses `getChartColors()` from `theme.ts`
- **Glass surfaces:** `--mix-*` / `--surface-*` in `app.css`; layout uses `SURFACE_CLASS` from `theme.ts` + `.surface-*` (backdrop-filter)
- **Loading states:** `.skeleton` in `app.css`; `*Skeleton.svelte`; `refresh-pending` + `RefreshOverlay` during fetch/optimize
- **Native selects:** period / interval / strategy via `NATIVE_SELECT_CLASS`; bits-ui for tabs, dropdown, checkbox, etc. in `ui/`
- PWA `theme_color` in `static/site.webmanifest` must match `META_THEME_COLOR` in `theme.ts`; manifest + icons only, **no service worker**

## Work guidance

- shadcn UI in `src/lib/components/ui/` is generated; ignore in oxlint
- Period/interval/strategy: native `<select>` (`NATIVE_SELECT_CLASS` in `app.css`); bits-ui for other `ui/` primitives only
- `$state.raw` for API response objects (reassigned, not mutated)

## Verification

```bash
cd web && bun run qa          # oxfmt --check, oxlint, svelte-check, bun test
cd web && bun run qa:fix      # auto-fix format + lint
devenv tasks run qa:web       # same via devenv (runs after install)
devenv tasks run build:web    # production build → web/build/
```

## Child DOX Index

(none)
