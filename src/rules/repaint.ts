import type { Finding, Rule } from "../types.ts";
import {
  argOf,
  declarationLine,
  isExplicitlyTrue,
  matchingLines,
} from "./util.ts";

const ORDER_CALL = /strategy\.(?:entry|order|close|exit|close_all)\s*\(/;

export const repaintRules: readonly Rule[] = [
  {
    id: "PA010",
    category: "repaint",
    run: (ctx) => {
      if (
        !ctx.isStrategy ||
        !isExplicitlyTrue(argOf(ctx, "calc_on_every_tick"))
      )
        return [];
      return [
        {
          id: "PA010",
          severity: "high",
          category: "repaint",
          title:
            "calc_on_every_tick makes live behaviour differ from the backtest",
          line: declarationLine(ctx),
          evidence: "calc_on_every_tick = true",
          why: "Historical bars are evaluated once at close; realtime bars are evaluated on every tick. The strategy you backtested and the strategy that will trade your money are two different programs.",
          fix: "Leave it false, or gate every order call behind barstate.isconfirmed so both contexts act only on closed bars.",
        },
      ];
    },
  },
  {
    id: "PA011",
    category: "repaint",
    run: (ctx) =>
      matchingLines(ctx, /\bvarip\b/).map(({ line, text }): Finding => ({
        id: "PA011",
        severity: "high",
        category: "repaint",
        title: "varip state cannot be reproduced historically",
        line: line.n,
        evidence: text,
        why: "varip persists across intrabar ticks. Historical bars have no ticks to persist across, so the variable follows a completely different trajectory in the backtest than it will live.",
        fix: "Use a plain var for anything that feeds an order decision. Reserve varip for display-only realtime counters.",
      })),
  },
  {
    id: "PA012",
    category: "repaint",
    run: (ctx) => {
      if (
        !ctx.isStrategy ||
        !isExplicitlyTrue(argOf(ctx, "calc_on_every_tick"))
      )
        return [];
      const guarded = ctx.lines.some((l) =>
        /barstate\s*\.\s*isconfirmed/.test(l.code),
      );
      if (guarded) return [];

      return matchingLines(ctx, ORDER_CALL)
        .slice(0, 1)
        .map(({ line, text }): Finding => ({
          id: "PA012",
          severity: "high",
          category: "repaint",
          title: "Tick-by-tick orders with no confirmation guard",
          line: line.n,
          evidence: text,
          why: "With calc_on_every_tick on and no barstate.isconfirmed anywhere in the script, live orders fire mid-bar on conditions that may reverse before the bar closes. The backtest never simulates that reversal, so it never books the loss.",
          fix: 'Append "and barstate.isconfirmed" to the order condition, accepting one bar of entry delay.',
        }));
    },
  },
  {
    id: "PA013",
    category: "repaint",
    run: (ctx) =>
      matchingLines(ctx, /barstate\s*\.\s*isnew\b/).map(
        ({ line, text }): Finding => ({
          id: "PA013",
          severity: "medium",
          category: "repaint",
          title:
            "barstate.isnew fires at different moments historically and live",
          line: line.n,
          evidence: text,
          why: "It is true at the open of a realtime bar but on the close of a historical one. Any timing logic built on it silently shifts by one bar between backtest and live.",
          fix: "Anchor the logic to barstate.isconfirmed, or to an explicit bar_index change you control.",
        }),
      ),
  },
];
