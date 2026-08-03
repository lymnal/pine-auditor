export const SEVERITIES = ["critical", "high", "medium", "low"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const CATEGORIES = [
  "lookahead",
  "repaint",
  "fills",
  "sizing",
  "overfit",
  "correctness",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const SEVERITY_RANK: Readonly<Record<Severity, number>> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export interface Finding {
  readonly id: string;
  readonly severity: Severity;
  readonly category: Category;
  readonly title: string;
  readonly line: number;
  readonly evidence: string;
  readonly why: string;
  readonly fix: string;
}

export interface SourceLine {
  readonly n: number;
  readonly raw: string;
  /** Comments and string-literal contents blanked to spaces; columns preserved. */
  readonly code: string;
  /** Comments blanked, string literals intact — needed to read order ids. */
  readonly codeWithStrings: string;
}

export interface DeclarationCall {
  readonly found: boolean;
  readonly line: number;
  readonly named: ReadonlyMap<string, string>;
  readonly positional: readonly string[];
  readonly text: string;
}

export interface AuditContext {
  readonly filePath: string;
  readonly lines: readonly SourceLine[];
  readonly declaration: DeclarationCall;
  readonly isStrategy: boolean;
  readonly inputCount: number;
  readonly entryIds: ReadonlySet<string>;
}

export interface Rule {
  readonly id: string;
  readonly category: Category;
  readonly run: (ctx: AuditContext) => Finding[];
}
