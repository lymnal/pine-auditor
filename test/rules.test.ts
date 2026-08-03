import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";
import { lex } from "../src/lexer.ts";
import { buildContext } from "../src/parse.ts";
import { audit } from "../src/rules/index.ts";
import { ALL_RULES } from "../src/rules/index.ts";
import { SEVERITY_RANK } from "../src/types.ts";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string): string => join(here, "..", "fixtures", name);

const findingsFor = (name: string) => {
  const path = fixture(name);
  return audit(buildContext(path, lex(readFileSync(path, "utf8"))));
};

/** Every rule the lying fixture is built to trip. Keeping this explicit makes
 * rule regressions loud: delete a rule's trigger and this test names it. */
const EXPECTED_ON_LIAR = [
  "PA001",
  "PA002",
  "PA010",
  "PA011",
  "PA012",
  "PA013",
  "PA020",
  "PA021",
  "PA022",
  "PA023",
  "PA024",
  "PA025",
  "PA030",
  "PA031",
  "PA032",
  "PA033",
  "PA040",
  "PA041",
  "PA042",
  "PA050",
  "PA052",
] as const;

test("rule ids are unique", () => {
  const ids = ALL_RULES.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length, "duplicate rule id");
});

test("lying fixture trips every rule it was built to trip", () => {
  const fired = new Set(findingsFor("lying-strategy.pine").map((f) => f.id));
  const missed = EXPECTED_ON_LIAR.filter((id) => !fired.has(id));
  assert.deepEqual(missed, [], `rules failed to fire: ${missed.join(", ")}`);
});

test("honest fixture has no critical or high findings", () => {
  const serious = findingsFor("honest-strategy.pine").filter(
    (f) => SEVERITY_RANK[f.severity] <= SEVERITY_RANK.high,
  );
  assert.deepEqual(
    serious.map((f) => `${f.id}: ${f.title}`),
    [],
    "false positives on the honest fixture",
  );
});

test("every finding carries evidence, a why and a fix", () => {
  for (const f of findingsFor("lying-strategy.pine")) {
    assert.ok(f.evidence.length > 0, `${f.id} has no evidence`);
    assert.ok(f.why.length > 40, `${f.id} why is too thin to act on`);
    assert.ok(f.fix.length > 20, `${f.id} fix is too thin to act on`);
    assert.ok(f.line > 0, `${f.id} has no line anchor`);
  }
});

test("comments and strings never produce findings", () => {
  const source = [
    "//@version=6",
    'strategy("x", commission_value = 0.1, slippage = 1, use_bar_magnifier = true,',
    "     margin_long = 50, margin_short = 50, initial_capital = 1000)",
    "// varip calc_on_every_tick = true barmerge.lookahead_on timestamp(2020,1,1,0,0)",
    'note = "varip and barmerge.lookahead_on inside a string"',
    "strategy.risk.max_intraday_loss(5, strategy.percent_of_equity)",
  ].join("\n");

  const findings = audit(buildContext("inline.pine", lex(source)));
  const bad = findings.filter((f) =>
    ["PA001", "PA002", "PA010", "PA011", "PA040"].includes(f.id),
  );
  assert.deepEqual(
    bad.map((f) => f.id),
    [],
    "lexer leaked comment/string content into rules",
  );
});
