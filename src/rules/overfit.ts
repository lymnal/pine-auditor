import type { Finding, Rule } from "../types.ts";
import { declarationLine, matchingLines } from "./util.ts";

const TUNABLE_THRESHOLD = 6;

export const overfitRules: readonly Rule[] = [
  {
    id: "PA040",
    category: "overfit",
    run: (ctx) =>
      matchingLines(ctx, /\btimestamp\s*\(/).map(({ line, text }): Finding => ({
        id: "PA040",
        severity: "high",
        category: "overfit",
        title: "Hardcoded date window in the strategy source",
        line: line.n,
        evidence: text,
        why: "A date filter baked into the script is the signature of a window chosen after seeing the results. The strategy is then reported on the same data that selected it, which guarantees it looks good and says nothing about tomorrow.",
        fix: "Expose the window as inputs, fit on one period and report on a later untouched one. If the out-of-sample result is materially worse, the in-sample result was curve fit.",
      })),
  },
  {
    id: "PA041",
    category: "overfit",
    run: (ctx) => {
      if (ctx.inputCount < TUNABLE_THRESHOLD) return [];
      return [
        {
          id: "PA041",
          severity: "medium",
          category: "overfit",
          title: `${ctx.inputCount} tunable inputs — large search space`,
          line: declarationLine(ctx),
          evidence: `${ctx.inputCount} input.* declarations`,
          why: "Each knob multiplies the number of parameter combinations you can try. With enough of them, some combination will fit any price series by luck alone, and the Strategy Tester will present that luck as an edge.",
          fix: "Fix every parameter you are not explicitly testing. Judge a result by how it holds across a neighbourhood of parameter values — a real edge degrades gracefully, a fitted one falls off a cliff.",
        },
      ];
    },
  },
  {
    id: "PA042",
    category: "overfit",
    run: (ctx) => {
      if (!ctx.isStrategy) return [];
      const hasRiskGuard = ctx.lines.some((l) =>
        /strategy\s*\.\s*risk\s*\./.test(l.code),
      );
      if (hasRiskGuard) return [];
      return [
        {
          id: "PA042",
          severity: "low",
          category: "overfit",
          title: "No strategy.risk.* circuit breaker",
          line: declarationLine(ctx),
          evidence: "no strategy.risk.max_intraday_loss or equivalent",
          why: "Without a hard loss limit the backtest is free to trade through a catastrophic day that you would have halted in real life, so the reported recovery is one you would never have been present for.",
          fix: "Add strategy.risk.max_intraday_loss and any position cap you would enforce by hand, so the simulation is bounded the same way you are.",
        },
      ];
    },
  },
];
