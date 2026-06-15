---
name: macrosignal
description: >
  MacroSignal repo agent guide. Use when editing this codebase, running QA,
  extending the Litestar API or SvelteKit dashboard, or when the user says
  /macrosignal, "MacroSignal", "devenv test", or "litestar-svelte refactor".
  Read AGENTS.md first; follow ponytail minimalism and DOX docs.
---

# MacroSignal

Educational trading backtester: **Litestar API** + **SvelteKit 2 / Bun** dashboard.
**License:** AGPL-3.0-or-later. **Repo:** https://github.com/nordrune/macrosignal

## Before editing

1. Read root `AGENTS.md`, then the `AGENTS.md` in the path you touch (`web/`, `trading_backtester/`, `tests/`).
2. Do not add pnpm/Node, ESLint/Prettier, or FastAPI; stack is fixed.

## Architecture

| Layer | Path | Notes |
|-------|------|-------|
| API | `trading_backtester/api.py`, `dto.py` | msgspec DTOs; no static files |
| Domain | `backtester.py`, `strategy.py`, `models.py` | framework-free |
| Web | `web/src/routes/+page.svelte` | Svelte 5 runes; i18n via `createContext` |
| Dev proxy | `web/vite.config.ts`, `hooks.server.ts` | `API_ORIGIN` env |

## QA (always verify)

```bash
devenv test                    # full gate; kill devenv up first (port 41793)
devenv tasks run qa:web        # Oxc + svelte-check
cd web && bun run qa
python -m trading_backtester.main data/sample_prices.csv
```

**Port conflict:** never run `devenv up` and `devenv test` together.

## Coding rules

- **Ponytail:** delete before adding; mark shortcuts with `// ponytail:` or `# ponytail:`
- **Svelte 5:** `$state`, `$derived`, `$state.raw` for API payloads; context over stores; `$effect` only for DOM/canvas sync
- **TypeScript:** strict; native `<select>` for period/interval/strategy (not bits-ui Select)
- **Python:** Litestar POST params named `data` (not `request`); HTTP 200 on POSTs
- **UI:** shadcn in `ui/` is generated; oxlint ignores it; do not add unused shadcn components
- **Charts:** canvas in `PriceChart.svelte`, no chart library
- **Docs:** DOX `AGENTS.md` tree only; no changelog prose in README

## Known risks (premortem)

- Default UX hits live Yahoo Finance; tests mock `/api/ticker`; smoke uses fixture prices
- `devenv up` + `devenv test` conflict on port 41793; kill `devenv up` first
- `MAX_PRICE_POINTS` (10_000) caps custom CSV payloads server-side
- Prod needs `API_ORIGIN` on Bun server; see `web/.env.example`
- Open API if exposed publicly; educational scope only; no auth

## Deferred (do not implement unless asked)

- Granian prod API server

## Common tasks

| Task | Where |
|------|-------|
| New API field | `dto.py` → `api.py` → `web/src/lib/api.ts` → UI |
| New UI string | `web/src/lib/i18n/strings.ts` (de + en) |
| New strategy | `strategy.py` + `web/src/lib/strategy.ts` |
| Responsive tweak | Tailwind `sm:`/`md:`/`lg:` on `+page.svelte` |