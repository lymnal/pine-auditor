import { correctnessRules } from "./correctness.ts";
import { fillRules } from "./fills.ts";
import { lookaheadRules } from "./lookahead.ts";
import { overfitRules } from "./overfit.ts";
import { repaintRules } from "./repaint.ts";
import { sizingRules } from "./sizing.ts";
import type { AuditContext, Finding, Rule } from "../types.ts";
import { SEVERITY_RANK } from "../types.ts";

export const ALL_RULES: readonly Rule[] = [
  ...lookaheadRules,
  ...repaintRules,
  ...fillRules,
  ...sizingRules,
  ...overfitRules,
  ...correctnessRules,
];

export const audit = (ctx: AuditContext): readonly Finding[] =>
  ALL_RULES.flatMap((rule) => rule.run(ctx)).sort(
    (a, b) =>
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || a.line - b.line,
  );
