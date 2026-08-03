import type { Finding, Rule, SourceLine } from "../types.ts";
import { joinedCodeWithStrings, lineOf } from "../lexer.ts";

const SECURITY_CALL = /request\s*\.\s*security(?:_lower_tf)?\s*\(/g;

interface SecurityCall {
  readonly line: number;
  readonly text: string;
}

const extractSecurityCalls = (
  lines: readonly SourceLine[],
): readonly SecurityCall[] => {
  const code = joinedCodeWithStrings(lines);
  const calls: SecurityCall[] = [];

  for (const match of code.matchAll(SECURITY_CALL)) {
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

const hasHistoricalOffset = (text: string): boolean =>
  /\[\s*[1-9]\d*\s*\]/.test(text);

export const lookaheadRules: readonly Rule[] = [
  {
    id: "PA001",
    category: "lookahead",
    run: (ctx) =>
      extractSecurityCalls(ctx.lines)
        .filter(
          (c) =>
            /barmerge\s*\.\s*lookahead_on/.test(c.text) &&
            !hasHistoricalOffset(c.text),
        )
        .map((c): Finding => ({
          id: "PA001",
          severity: "critical",
          category: "lookahead",
          title: "lookahead_on without a historical offset leaks future data",
          line: c.line,
          evidence: condense(c.text),
          why: "On historical bars this returns the higher-timeframe value before it could have been known. The equity curve is fiction — it trades on data from the future. TradingView prohibits this pattern in published scripts.",
          fix: "lookahead_on is only safe paired with an offset: request.security(sym, tf, expr[1], lookahead = barmerge.lookahead_on). The two are interdependent; neither works alone.",
        })),
  },
  {
    id: "PA002",
    category: "lookahead",
    run: (ctx) =>
      extractSecurityCalls(ctx.lines)
        .filter(
          (c) =>
            !/barmerge\s*\.\s*lookahead/.test(c.text) &&
            !hasHistoricalOffset(c.text),
        )
        .map((c): Finding => ({
          id: "PA002",
          severity: "high",
          category: "lookahead",
          title: "request.security without offset repaints on realtime bars",
          line: c.line,
          evidence: condense(c.text),
          why: "Historical bars see only the confirmed higher-timeframe value; realtime bars see the still-forming one. Backtest and live execution diverge, and the divergence always favours the backtest.",
          fix: "Offset the expression by [1] and add lookahead = barmerge.lookahead_on, or gate the signal behind barstate.isconfirmed.",
        })),
  },
];

const condense = (text: string): string =>
  text.replace(/\s+/g, " ").trim().slice(0, 160);
