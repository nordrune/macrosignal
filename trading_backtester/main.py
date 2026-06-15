"""Command-line interface for the trading backtester."""

import argparse
import os
import sys
from collections.abc import Sequence

from trading_backtester.backtester import format_results, run_backtest
from trading_backtester.data_loader import load_price_data


def build_parser() -> argparse.ArgumentParser:
    """Build the command-line argument parser."""
    parser = argparse.ArgumentParser(
        description=(
            "Run a trading backtest on CSV price data or launch the web server."
        ),
    )
    parser.add_argument(
        "csv_file",
        nargs="?",
        help="Path to a CSV file containing date and close columns.",
    )
    parser.add_argument(
        "--server",
        action="store_true",
        help="Start the web server dashboard.",
    )
    parser.add_argument(
        "--host",
        default="127.0.0.1",
        help="Host address to bind the server to (default: 127.0.0.1).",
    )
    default_port = int(os.environ.get("PORT", "41793"))
    parser.add_argument(
        "--port",
        type=int,
        default=default_port,
        help="Port to run the web server on (default: $PORT or 41793).",
    )
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    """Run the command-line application or start the web server.

    Args:
        argv: Optional argument list used mainly for testing.

    Returns:
        Process exit code.
    """
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.server:
        import uvicorn

        print(
            f"Starting MacroSignal dashboard on http://{args.host}:{args.port}"
        )
        uvicorn.run(
            "trading_backtester.api:app",
            host=args.host,
            port=args.port,
            log_level="info",
        )
        return 0

    if not args.csv_file:
        parser.print_usage(sys.stderr)
        print(
            "Error: must specify csv_file or run with --server", file=sys.stderr
        )
        return 1

    try:
        price_data = load_price_data(args.csv_file)
        result = run_backtest(price_data)
    except (FileNotFoundError, OSError, ValueError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    print(format_results(result))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
