# MacroSignal

Educational trading backtester: Litestar API + SvelteKit/Bun dashboard. Simulates SMA/EMA
strategies on historical prices. No broker integration or live trading.

**License:** [AGPL-3.0](LICENSE) · **Source:** [github.com/nordrune/macrosignal](https://github.com/nordrune/macrosignal)

## Quick start

Requires [devenv](https://devenv.sh/getting-started/) + [Nix](https://nixos.org/download/).

```bash
devenv allow && direnv allow
devenv up          # API :41793 + web :5173 → open http://127.0.0.1:5173
devenv test        # full QA (stop devenv up first; port conflict)
```

CLI backtest: `python -m trading_backtester.main data/sample_prices.csv`

## Stack

| Layer | Path |
|-------|------|
| API | `trading_backtester/` (Litestar, msgspec DTOs) |
| Web | `web/` (SvelteKit 2, Bun, Tailwind v4, Oxc) |
| Env | `devenv.nix` (`API_ORIGIN`, `API_PORT`, `WEB_PORT`) |

Agent/docs index: [AGENTS.md](AGENTS.md) · Repo skill: `/macrosignal`

## QA

```bash
devenv test                    # ruff, ty, pytest, Oxc, svelte-check, smoke
devenv tasks run qa:web        # web only
cd web && bun run qa
devenv tasks run build:web     # production build
```

## Scope

Included: backtesting, virtual trades, fees, metrics, optimizer, CSV/Excel/PDF export, DE/EN UI.

Not included: live trading, broker APIs, multi-asset portfolios.

## Code stats

Auto-updated on commit: [tokei.txt](tokei.txt)