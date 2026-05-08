"""Command-line interface for the trading backtester."""

import argparse
import sys
from collections.abc import Sequence

from trading_backtester.backtester import format_results, run_backtest
from trading_backtester.data_loader import load_price_data


def build_parser() -> argparse.ArgumentParser:
    """Build the command-line argument parser."""
    parser = argparse.ArgumentParser(
        description="Run a simple moving average backtest on CSV price data.",
    )
    parser.add_argument(
        "csv_file",
        help="Path to a CSV file containing date and close columns.",
    )
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    """Run the command-line application.

    Args:
        argv: Optional argument list used mainly for testing.

    Returns:
        Process exit code.
    """
    parser = build_parser()
    args = parser.parse_args(argv)

    try:
        price_data = load_price_data(args.csv_file)
        result = run_backtest(price_data)
    except (FileNotFoundError, OSError, ValueError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    print(format_results(result))
    return 0
