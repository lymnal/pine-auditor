import { joinedCodeWithStrings, lineOf } from "../lexer.ts";
import type { Finding, Rule } from "../types.ts";

const EXIT_CALL = /strategy\.exit\s*\(/g;
const EXIT_TRIGGERS =
  /\b(?:stop|limit|profit|loss|trail_points|trail_price|trail_offset)\s*=/;
const FROM_ENTRY = /from_entry\s*=\s*("?)([\w .-]+)\1/;

interface ExitCall {
  readonly line: number;
  readonly text: string;
}

const extractExitCalls = (
  code: string,
  lines: Parameters<typeof lineOf>[0],
): readonly ExitCall[] => {
  const calls: ExitCall[] = [];
  for (const match of code.matchAll(EXIT_CALL)) {
    const open = match.index + match[0].length - 1;
    let depth = 0;
    for (let i = open; i < code.length; i += 1) {
      const ch = code[i] as string;
      if (ch === "(") depth += 1;
      if (ch === ")") {
        depth -= 1;
        if (depth === 0) {
          calls.push({
            line: lineOf(lines, match.index),
            text: code.slice(match.index, i + 1),
          });
          break;
        }
      }
    }
  }
  return calls;
};

export const correctnessRules: readonly Rule[] = [
  {
    id: "PA050",
    category: "correctness",
    run: (ctx) =>
      extractExitCalls(joinedCodeWithStrings(ctx.lines), ctx.lines)
        .filter((c) => !EXIT_TRIGGERS.test(c.text))
        .map((c): Finding => ({
          id: "PA050",
          severity: "high",
          category: "correctness",
          title: "strategy.exit has no trigger and will never fire",
          line: c.line,
          evidence: c.text.replace(/\s+/g, " ").slice(0, 160),
          why: "An exit with no stop, limit, or trail is a no-op. Positions stay open until an opposing entry closes them, so the backtest silently reports a different strategy from the one you wrote — usually one with far larger excursions.",
          fix: "Supply at least one of stop, limit, or a trail_* pair, or use strategy.close() if an unconditional exit is what you meant.",
        })),
  },
  {
    id: "PA052",
    category: "correctness",
    run: (ctx) => {
      if (ctx.entryIds.size === 0) return [];
      return extractExitCalls(
        joinedCodeWithStrings(ctx.lines),
        ctx.lines,
      ).flatMap((c): Finding[] => {
        const match = FROM_ENTRY.exec(c.text);
        const id = match?.[2]?.trim();
        if (id === undefined || ctx.entryIds.has(id)) return [];
        return [
          {
            id: "PA052",
            severity: "high",
            category: "correctness",
            title: `strategy.exit references unknown entry id "${id}"`,
            line: c.line,
            evidence: c.text.replace(/\s+/g, " ").slice(0, 160),
            why: `No strategy.entry or strategy.order declares "${id}", so this exit is orphaned and never attaches to a position. Stops you believe are protecting you do not exist.`,
            fix: `Match the id exactly against an entry — declared ids are: ${[...ctx.entryIds].join(", ")}.`,
          },
        ];
      });
    },
  },
  {
    id: "PA053",
    category: "correctness",
    run: (ctx) => {
      if (!ctx.isStrategy) return [];
      const hasEntry = ctx.entryIds.size > 0;
      const hasAnyExit = ctx.lines.some((l) =>
        /strategy\.(?:exit|close|close_all)\s*\(/.test(l.code),
      );
      if (!hasEntry || hasAnyExit) return [];
      return [
        {
          id: "PA053",
          severity: "high",
          category: "correctness",
          title: "Entries with no exit logic anywhere",
          line: ctx.declaration.line,
          evidence: `${ctx.entryIds.size} entry id(s), no exit/close call`,
          why: "Positions only ever close by reversal. The strategy is always in the market, so the backtest is measuring the underlying instrument as much as the signal.",
          fix: "Add explicit exits, then compare against buy-and-hold. If the signal does not beat holding, the signal is decoration.",
        },
      ];
    },
  },
];
