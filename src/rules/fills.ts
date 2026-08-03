import type { Finding, Rule } from "../types.ts";
import {
  argOf,
  declarationLine,
  isExplicitlyTrue,
  matchingLines,
  numericArg,
} from "./util.ts";

export const fillRules: readonly Rule[] = [
  {
    id: "PA020",
    category: "fills",
    run: (ctx) => {
      if (!ctx.isStrategy) return [];
      const value = numericArg(ctx, "commission_value");
      const raw = argOf(ctx, "commission_value");
      const missing = raw === undefined;
      if (!missing && value !== 0) return [];

      return [
        {
          id: "PA020",
          severity: "critical",
          category: "fills",
          title: missing
            ? "No commission configured"
            : "Commission explicitly set to zero",
          line: declarationLine(ctx),
          evidence: missing
            ? "strategy(...) omits commission_value"
            : `commission_value = ${raw}`,
          why: "Commission defaults to zero. Every backtested trade is free, which flatters high-frequency logic most — a strategy that trades 2,000 times can show a fat profit that is entirely the commission it never paid.",
          fix: "Set commission_type = strategy.commission.percent with your broker's real rate, or strategy.commission.cash_per_contract for futures. Then re-read the equity curve.",
        },
      ];
    },
  },
  {
    id: "PA021",
    category: "fills",
    run: (ctx) => {
      if (!ctx.isStrategy) return [];
      const value = numericArg(ctx, "slippage");
      const raw = argOf(ctx, "slippage");
      const missing = raw === undefined;
      if (!missing && value !== 0) return [];

      return [
        {
          id: "PA021",
          severity: "critical",
          category: "fills",
          title: missing
            ? "No slippage configured"
            : "Slippage explicitly set to zero",
          line: declarationLine(ctx),
          evidence: missing
            ? "strategy(...) omits slippage"
            : `slippage = ${raw}`,
          why: "Slippage defaults to 0, so every market order fills at the exact theoretical price. Real fills walk the book, and they walk furthest in precisely the fast conditions most breakout and momentum logic depends on.",
          fix: "Set slippage in ticks to at least one tick, and stress-test at 2-3x your assumption. If the edge dies at 2 ticks it was never an edge.",
        },
      ];
    },
  },
  {
    id: "PA022",
    category: "fills",
    run: (ctx) => {
      if (!ctx.isStrategy || isExplicitlyTrue(argOf(ctx, "use_bar_magnifier")))
        return [];
      return [
        {
          id: "PA022",
          severity: "medium",
          category: "fills",
          title: "Bar Magnifier off — intrabar fills are guessed",
          line: declarationLine(ctx),
          evidence: "strategy(...) does not set use_bar_magnifier = true",
          why: "Without it the broker emulator infers intrabar order using only the OHLC of the chart timeframe. When a bar hits both your stop and your target, the emulator picks an order — and the assumption it makes is not necessarily the one the market made.",
          fix: "Set use_bar_magnifier = true. This is a paid-tier feature and it is included in your Premium plan; leaving it off discards accuracy you already bought.",
        },
      ];
    },
  },
  {
    id: "PA023",
    category: "fills",
    run: (ctx) => {
      if (
        !ctx.isStrategy ||
        !isExplicitlyTrue(argOf(ctx, "process_orders_on_close"))
      )
        return [];
      return [
        {
          id: "PA023",
          severity: "medium",
          category: "fills",
          title: "Orders processed on the closing bar",
          line: declarationLine(ctx),
          evidence: "process_orders_on_close = true",
          why: "Orders fill at the close of the bar that produced the signal. Live, you observe that close and act after it. The backtest is buying at a price that was only knowable at the instant it stopped being available.",
          fix: "Leave it false so orders fill at the next bar open, unless you genuinely trade MOC and have modelled the auction.",
        },
      ];
    },
  },
  {
    id: "PA024",
    category: "fills",
    run: (ctx) =>
      matchingLines(
        ctx,
        /strategy\.(?:entry|order|exit)\s*\([^)]*\blimit\s*=/,
      ).map(({ line, text }): Finding => ({
        id: "PA024",
        severity: "medium",
        category: "fills",
        title: "Limit order fills are optimistic by construction",
        line: line.n,
        evidence: text,
        why: "The broker emulator fills a limit order as soon as price reaches its value. A real limit order at that price joins a queue and frequently does not fill — especially at the extremes of a move, which is exactly where mean-reversion logic claims its profits.",
        fix: "Require price to trade through the level rather than touch it, or model a fill ratio. Compare against the same strategy using market orders to size the illusion.",
      })),
  },
  {
    id: "PA025",
    category: "fills",
    run: (ctx) => {
      if (!ctx.isStrategy) return [];
      const usesHeikin = matchingLines(
        ctx,
        /ticker\s*\.\s*heikinashi|heikinashi/i,
      );
      if (usesHeikin.length === 0) return [];
      if (isExplicitlyTrue(argOf(ctx, "fill_orders_on_standard_ohlc")))
        return [];

      return [
        {
          id: "PA025",
          severity: "high",
          category: "fills",
          title: "Heikin Ashi prices used for fills",
          line: (usesHeikin[0] as { line: { n: number } }).line.n,
          evidence: (usesHeikin[0] as { text: string }).text,
          why: "Heikin Ashi opens and closes are averages, not traded prices. Filling orders at them means backtesting against a price that never existed — this single mistake produces the most spectacular fake equity curves on TradingView.",
          fix: "Set fill_orders_on_standard_ohlc = true so the emulator uses real prices, then re-run. Expect the curve to change materially.",
        },
      ];
    },
  },
];
