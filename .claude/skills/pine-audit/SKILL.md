---
name: pine-audit
description: Audit a TradingView Pine Script strategy for backtest-integrity defects — lookahead bias, repainting, unrealistic fills, sizing illusions, and overfitting. Use when the user shares a .pine file, pastes Pine Script, asks why a backtest looks too good, asks whether a strategy is trustworthy, or asks to review a TradingView strategy before risking capital.
---

# Pine Script backtest audit

Two layers, in this order. Never skip layer 1 — it is free and it grounds layer 2.

## Layer 1 — deterministic (always)

```bash
node src/index.ts <file.pine> --format json
```

21 rules across lookahead, repaint, fills, sizing, overfit, correctness. Exit code 1 means something at or above `--fail-on` (default `high`) fired.

Report these findings verbatim. Do not re-derive, re-word, or re-judge them — they are already verified by construction.

## Layer 2 — semantic (only what layer 1 cannot reach)

Static analysis sees syntax. It cannot see meaning. Look for exactly these, reading the source alongside the layer-1 JSON:

1. **Circular logic** — a signal derived from a series that already contains the outcome it predicts (e.g. an indicator smoothed over a window that extends past the entry bar).
2. **Unreachable or dominated exits** — a stop that can never be hit before an opposing entry closes the position, making the reported risk profile fictional.
3. **Buy-and-hold proxy** — the strategy is long ~90%+ of bars in an instrument that rose over the window. Its "edge" is the underlying. Ask what it does on a flat or falling series.
4. **Survivorship in the instrument choice** — the strategy is tuned on a symbol selected *because* it trended.
5. **Regime dependence** — all profit concentrated in one volatility regime the script does not detect or adapt to.
6. **Cost sensitivity** — estimate whether the edge per trade exceeds the spread plus commission the layer-1 findings say were omitted. If average profit per trade is below round-trip cost, the strategy is dead regardless of its win rate.

## Verification (mandatory before reporting layer 2)

Every layer-2 candidate gets an adversarial pass: argue the finding is **wrong**. Default to refuted when uncertain. State the concrete failure scenario — specific bars, specific conditions — or drop it.

Report only what survives at high confidence. Count what you suppressed; do not list it.

## Output

```
## Deterministic  (N findings)
<verbatim from the CLI, most severe first>

## Semantic  (M confirmed, K suppressed below confidence floor)
<each: what, where, the mechanism, the failure scenario>

## Verdict
<one of: fatal — do not trade / material defects — fix and re-test / no known defect found>
```

The verdict is about **backtest integrity only**. It is never a statement about whether the strategy will make money, and never a recommendation to trade it. If the user asks for that, say plainly that a clean audit only means no known lie was detected, and that establishing edge requires forward testing on data that never touched the strategy's design.

## Hard limits

- Never edit the strategy file unless asked directly.
- Never place, size, or recommend a trade.
- Never state or imply an expected return.
