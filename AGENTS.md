# DOX framework

- DOX is the AGENTS.md hierarchy for this repo
- Read this file and child AGENTS.md before editing any path

## Project

MacroSignal: Litestar API + SvelteKit/Bun dashboard for trading backtests.
Educational tool; no broker integration. License: AGPL-3.0-or-later ([LICENSE](LICENSE)).
Repo: https://github.com/nordrune/macrosignal

## Global contracts

- Python: UV + devenv only; run QA via `devenv test`
- API routes: `GET /health`, `GET /api/ticker`, `POST /api/backtest`, `POST /api/optimize`
- DTOs live in `trading_backtester/dto.py` (msgspec); domain logic stays framework-free
- Frontend: SvelteKit 2 in `web/`; Bun package manager; `svelte-adapter-bun` for prod
- Dev: `devenv up` runs API (`:41793`) + SvelteKit (`:5173`); browser uses `:5173`
- Env: `API_ORIGIN`, `API_PORT`, `WEB_PORT`, `HOST` set in `devenv.nix` (used by Vite proxy + `hooks.server.ts`)
- Do not run `devenv up` and `devenv test` concurrently (API port conflict)
- Web QA: `devenv tasks run qa:web` or `cd web && bun run qa` (Oxc + `svelte-check`)
- Python QA: `ruff` + `ty`; full gate: `devenv test` (pre-push hook)
- Prod web build: `devenv tasks run build:web` → `web/build/` (gitignored)

## User preferences

- Ponytail minimalism: delete before adding; `# ponytail:` / `// ponytail:` on shortcuts
- Docs: DOX AGENTS.md tree (not changelog prose in README)
- Latest reasonable versions; Bun not pnpm/Node
- Agent skill: `.grok/skills/macrosignal/SKILL.md` (invoke with `/macrosignal`)

## Child DOX Index

| Path | Scope |
|------|--------|
| [trading_backtester/AGENTS.md](trading_backtester/AGENTS.md) | Python API, backtester, CLI |
| [web/AGENTS.md](web/AGENTS.md) | SvelteKit dashboard |
| [tests/AGENTS.md](tests/AGENTS.md) | pytest + smoke contract tests |