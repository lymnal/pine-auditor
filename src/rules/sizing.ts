import type { Finding, Rule } from "../types.ts";
import { argOf, declarationLine, numericArg } from "./util.ts";

export const sizingRules: readonly Rule[] = [
  {
    id: "PA030",
    category: "sizing",
    run: (ctx) => {
      if (!ctx.isStrategy) return [];
      const type = argOf(ctx, "default_qty_type") ?? "";
      if (!/percent_of_equity/.test(type)) return [];
      const qty = numericArg(ctx, "default_qty_value");
      if (qty === undefined || qty < 100) return [];

      return [
        {
          id: "PA030",
          severity: "high",
          category: "sizing",
          title: "Full-equity compounding produces an unachievable curve",
          line: declarationLine(ctx),
          evidence: `default_qty_type = ${type.trim()}, default_qty_value = ${qty}`,
          why: "Every trade risks the entire account, so a good run compounds into a vertical line that hides the drawdown underneath it. It also assumes fractional fills and instant reinvestment that no broker provides.",
          fix: "Size on a fixed fraction of equity you would actually risk, then judge the strategy on max drawdown and profit factor rather than net profit.",
        },
      ];
    },
  },
  {
    id: "PA031",
    category: "sizing",
    run: (ctx) => {
      if (!ctx.isStrategy) return [];
      const long = numericArg(ctx, "margin_long");
      const short = numericArg(ctx, "margin_short");
      const unset =
        argOf(ctx, "margin_long") === undefined &&
        argOf(ctx, "margin_short") === undefined;
      if (!unset && long !== 0 && short !== 0) return [];

      return [
        {
          id: "PA031",
          severity: "medium",
          category: "sizing",
          title: "No margin requirement — leverage is effectively unlimited",
          line: declarationLine(ctx),
          evidence: unset
            ? "margin_long / margin_short not set"
            : `margin_long = ${long}, margin_short = ${short}`,
          why: "At zero margin the emulator will happily open a position far larger than the account could support, and no margin call ever interrupts a losing streak. Real leverage liquidates you at the worst point of the drawdown.",
          fix: "Set margin_long and margin_short to your broker's actual requirement so oversized positions are rejected in the backtest too.",
        },
      ];
    },
  },
  {
    id: "PA032",
    category: "sizing",
    run: (ctx) => {
      if (!ctx.isStrategy) return [];
      const pyramiding = numericArg(ctx, "pyramiding");
      if (pyramiding === undefined || pyramiding <= 1) return [];
      if (numericArg(ctx, "margin_long") !== undefined) return [];

      return [
        {
          id: "PA032",
          severity: "medium",
          category: "sizing",
          title: `Pyramiding to ${pyramiding} entries with no margin model`,
          line: declarationLine(ctx),
          evidence: `pyramiding = ${pyramiding}`,
          why: "Adding to losers is the fastest way to make a backtest look smooth: losses stay unrealized while winners close. The equity curve flatters exactly the behaviour that produces ruin.",
          fix: "Set a margin requirement so stacked entries are capped, and inspect the worst open drawdown rather than closed-trade drawdown.",
        },
      ];
    },
  },
  {
    id: "PA033",
    category: "sizing",
    run: (ctx) => {
      if (!ctx.isStrategy || argOf(ctx, "initial_capital") !== undefined)
        return [];
      return [
        {
          id: "PA033",
          severity: "low",
          category: "sizing",
          title: "initial_capital not declared",
          line: declarationLine(ctx),
          evidence: "strategy(...) omits initial_capital",
          why: "Percentage returns are computed against a default account size that probably is not yours, making the headline return figure meaningless for position-sizing decisions.",
          fix: "Declare the capital you would actually commit.",
        },
      ];
    },
  },
];
