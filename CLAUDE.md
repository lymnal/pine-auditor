# pine-auditor

Static + semantic audit for TradingView Pine Script strategies. It exists to **falsify** strategies before they get capital, not to bless them.

## Prime directive

A clean report is not a green light. It means the deterministic layer found no *known* lie — nothing more. The tool's success metric is **strategies killed per hour**, not findings resolved.

The failure mode this repo exists to prevent has a name and a precedent: a signal can be highly *accurate* and carry zero *edge*, because the price already reflects it. A 98.4%-accurate predictor that emits zero profitable orders is a solved case, not a paradox. Every report should be read asking "does this survive costs and does the market not already know?" — never "is the win rate high?"

## Non-negotiables

- **Read-only.** This tool never edits a strategy, never places an order, never sizes a position, never recommends an instrument. It reports and exits.
- **No advice.** Findings describe mechanical defects in a backtest. They are not investment advice and must never be phrased as a prediction or a recommendation to trade.
- **Deterministic layer never regresses.** `npm test` is the contract. A rule without a fixture that trips it does not exist.

## Architecture: determinism first, model last

```
source.pine
  → lexer.ts        comments/strings blanked, columns preserved
  → parse.ts        declaration args, entry ids, input count
  → rules/*.ts      21 deterministic rules  ← EVERYTHING CHECKABLE LIVES HERE
  → report.ts       text | json | markdown
  → [optional] semantic pass via .claude/skills/pine-audit
```

**The rule that governs every change:** if a check can be expressed as a parse or a regex, it is a rule — never a prompt. Rules are free, instant, reproducible, and unit-testable. A prompt is none of those four. Reach for the model only where meaning is genuinely required: whether the *logic* is circular, whether an exit can be reached, whether the strategy is secretly a proxy for buy-and-hold.

Corollary: when the semantic pass finds something a rule could have caught, that is a bug report against `rules/`. Write the rule, add the fixture, delete the reliance on inference.

## Adding a rule

1. Pick the next free id in its category block (`PA0xx`).
2. Implement in the matching `src/rules/*.ts`. Every `Finding` needs `evidence` (what was seen), `why` (the mechanism by which it inflates the backtest), and `fix` (what to do instead). Vague findings get ignored, and an ignored auditor is worse than no auditor.
3. Add a trigger to `fixtures/lying-strategy.pine` and the id to `EXPECTED_ON_LIAR` in `test/rules.test.ts`.
4. Confirm `fixtures/honest-strategy.pine` stays clean — false positives are more expensive than misses here, because they train the user to skim.
5. `npm test && npm run typecheck`.

## Semantic pass conventions

When running the model layer (`.claude/skills/pine-audit`):

- **Ground it.** Feed the deterministic findings *and* the source. Never ask an open "find problems in this" — it hallucinates plausible-sounding defects that no rule can confirm.
- **Verify adversarially.** Every candidate finding gets a second pass whose only job is to refute it. Default to refuted when uncertain. Two independent refutations kill it.
- **Confidence floor.** Report nothing below high confidence. Suppressed candidates are counted, not listed.
- **No silent truncation.** If coverage was capped — files skipped, a long script sampled — say so in the report. Silence reads as "covered everything."

## Code standards

TypeScript strict, `noUncheckedIndexedAccess` on. `const` by default, no `any`, no enums (breaks Node's type stripping — use `as const` objects). Runs directly under Node ≥22.6 via native TS support; `tsc` is typecheck-only, there is no build step. Comments explain *why* only. Conventional commits.

## Known limits

- Regex/paren-balance parsing, not a real Pine AST. Deeply nested or unusually formatted declarations can be missed. When a rule needs true scope analysis, say so rather than approximating.
- `PA025` cannot see the chart's actual type — it fires on Heikin Ashi *references* in source. A strategy applied to an HA chart without any HA call in code is invisible to it.
- Static analysis cannot see the Strategy Tester output. Trade count, drawdown, and profit factor still require a human to read the panel; the deterministic rules only establish whether those numbers are worth reading at all.
