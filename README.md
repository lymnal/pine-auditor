# pine-auditor

[![ci](https://github.com/lymnal/pine-auditor/actions/workflows/ci.yml/badge.svg)](https://github.com/lymnal/pine-auditor/actions/workflows/ci.yml)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Static backtest-integrity audit for TradingView Pine Script strategies.

TradingView's Strategy Tester will happily report a 4,000% return on a strategy that trades on data from the future, fills at prices that never existed, and pays no commission. This finds those defects before they cost you money.

Read-only. It never places, sizes, or recommends a trade.

## Use

```bash
node src/index.ts strategy.pine
```

```bash
node src/index.ts strategy.pine --format markdown --min high
```

| Flag | Values | Default |
|---|---|---|
| `--format` | `text`, `json`, `markdown` | `text` |
| `--min` | `critical`, `high`, `medium`, `low` | `low` |
| `--fail-on` | severity, or `never` | `high` |

Exits 1 when anything at or above `--fail-on` fires — usable as a pre-commit gate.

## What a report looks like

Every finding carries three things: the evidence it saw, the mechanism by which that inflates the backtest, and what to do instead. A finding without all three is a bug.

```
$ node src/index.ts fixtures/lying-strategy.pine

 CRITICAL  PA001 lookahead_on without a historical offset leaks future data  (line 26)
      request.security(syminfo.tickerid, "D", high, lookahead = barmerge.lookahead_on)
      On historical bars this returns the higher-timeframe value before it could have been
      known. The equity curve is fiction — it trades on data from the future. TradingView
      prohibits this pattern in published scripts.
      Fix: lookahead_on is only safe paired with an offset: request.security(sym, tf,
      expr[1], lookahead = barmerge.lookahead_on). The two are interdependent; neither works
      alone.

 HIGH  PA030 Full-equity compounding produces an unachievable curve  (line 4)
      default_qty_type = strategy.percent_of_equity, default_qty_value = 100
      Every trade risks the entire account, so a good run compounds into a vertical line
      that hides the drawdown underneath it. It also assumes fractional fills and instant
      reinvestment that no broker provides.
      Fix: Size on a fixed fraction of equity you would actually risk, then judge the
      strategy on max drawdown and profit factor rather than net profit.

23 finding(s): 3 critical, 11 high, 7 medium, 2 low
```

The companion fixture is the other half of the contract:

```
$ node src/index.ts fixtures/honest-strategy.pine
PASS fixtures/honest-strategy.pine — no deterministic backtest-integrity issues found.
```

## Rules

**Lookahead** — the defects that make a backtest pure fiction.

| | |
|---|---|
| `PA001` | `lookahead_on` without a historical offset — reads future bars |
| `PA002` | `request.security` without offset — repaints live |

**Repaint** — backtest and live execution are different programs.

| | |
|---|---|
| `PA010` | `calc_on_every_tick = true` |
| `PA011` | `varip` state, unreproducible historically |
| `PA012` | tick-by-tick orders with no `barstate.isconfirmed` guard |
| `PA013` | `barstate.isnew` fires at different moments in each context |

**Fills** — the quiet killers.

| | |
|---|---|
| `PA020` | no commission — every trade is free |
| `PA021` | no slippage — every fill is perfect |
| `PA022` | Bar Magnifier off — intrabar order is guessed |
| `PA023` | `process_orders_on_close` — fills at a price only knowable as it vanished |
| `PA024` | limit orders fill on touch, not through |
| `PA025` | Heikin Ashi prices used for fills — averages, not traded prices |

**Sizing**

| | |
|---|---|
| `PA030` | 100% equity compounding hides the drawdown underneath |
| `PA031` | no margin requirement — leverage is unbounded |
| `PA032` | pyramiding with no margin model |
| `PA033` | `initial_capital` undeclared |

**Overfit**

| | |
|---|---|
| `PA040` | hardcoded date window — the signature of a period chosen after the fact |
| `PA041` | large tunable-parameter search space |
| `PA042` | no `strategy.risk.*` circuit breaker |

**Correctness**

| | |
|---|---|
| `PA050` | `strategy.exit` with no trigger — a silent no-op |
| `PA052` | `strategy.exit` bound to an entry id that does not exist |
| `PA053` | entries with no exit logic anywhere |

## Validated against real strategies

Run on 8 public strategies from 3 independent authors (1,826 lines of code the rules were not written against): **88 findings, no false positives** — every one spot-checked against source.

| | |
|---|---|
| No commission *and* no slippage | 6 of 8 |
| `request.security` without offset (`PA002`) | 17 hits across 5 files |
| Limit orders assumed filled on touch (`PA024`) | 22 hits |
| 100% equity compounding (`PA030`) | 5 files |
| Outright future leak (`PA001`) | 0 — no file contained `lookahead` at all |
| Broken exits (`PA050`/`PA052`/`PA053`) | 0 |

The two strategies that set commission and slippage were the only two with zero critical findings. That is the whole distribution in one line: most published strategies are not lying about the future, they are just trading for free.

## Semantic layer

The CLI catches what is mechanically checkable. `.claude/skills/pine-audit` adds a model-driven pass for what is not — circular logic, unreachable exits, buy-and-hold proxies, regime dependence, cost sensitivity — with adversarial verification and a confidence floor.

Order matters: deterministic first, always. It is free, and it grounds the semantic pass so the model confirms mechanisms instead of inventing them.

## Develop

```bash
npm test && npm run typecheck
```

`fixtures/lying-strategy.pine` is built to trip all 21 rules; `fixtures/honest-strategy.pine` must stay clean. A rule with no fixture that trips it does not exist. See [CLAUDE.md](CLAUDE.md).

## What this does not do

It cannot tell you whether a strategy is profitable. A clean report means no *known* lie was found in the backtest — it says nothing about edge. Establishing edge requires forward testing on data that never touched the strategy's design, and most strategies that survive this audit still have none.
