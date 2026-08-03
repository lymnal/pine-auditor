#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { lex } from "./lexer.ts";
import { buildContext } from "./parse.ts";
import { renderJson, renderMarkdown, renderTerminal } from "./report.ts";
import { audit } from "./rules/index.ts";
import { SEVERITY_RANK, type Finding, type Severity } from "./types.ts";

const FORMATS = ["text", "json", "markdown"] as const;
type Format = (typeof FORMATS)[number];

interface Options {
  readonly files: readonly string[];
  readonly format: Format;
  readonly minSeverity: Severity;
  readonly failOn: Severity | "never";
}

const USAGE = `pine-audit — static backtest-integrity audit for Pine Script strategies

  pine-audit <file.pine> [more.pine ...] [options]

  --format <text|json|markdown>   output shape (default: text)
  --min <critical|high|medium|low>  suppress findings below this (default: low)
  --fail-on <critical|high|medium|low|never>  exit 1 threshold (default: high)

This tool is read-only. It never places, sizes, or recommends a trade.
It exists to falsify strategies, not to bless them.
`;

const parseArgs = (argv: readonly string[]): Options | null => {
  const files: string[] = [];
  let format: Format = "text";
  let minSeverity: Severity = "low";
  let failOn: Severity | "never" = "high";

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i] as string;
    const next = argv[i + 1];

    if (arg === "--help" || arg === "-h") return null;
    if (arg === "--format" && next !== undefined) {
      if (!FORMATS.includes(next as Format))
        throw new Error(`bad --format: ${next}`);
      format = next as Format;
      i += 1;
    } else if (arg === "--min" && next !== undefined) {
      minSeverity = assertSeverity(next);
      i += 1;
    } else if (arg === "--fail-on" && next !== undefined) {
      failOn = next === "never" ? "never" : assertSeverity(next);
      i += 1;
    } else if (arg.startsWith("-")) {
      throw new Error(`unknown flag: ${arg}`);
    } else {
      files.push(arg);
    }
  }

  return files.length === 0 ? null : { files, format, minSeverity, failOn };
};

const assertSeverity = (value: string): Severity => {
  if (value in SEVERITY_RANK) return value as Severity;
  throw new Error(`bad severity: ${value}`);
};

const auditFile = async (
  path: string,
  min: Severity,
): Promise<readonly Finding[]> => {
  const source = await readFile(resolve(path), "utf8");
  const ctx = buildContext(path, lex(source));
  return audit(ctx).filter(
    (f) => SEVERITY_RANK[f.severity] <= SEVERITY_RANK[min],
  );
};

const main = async (): Promise<number> => {
  let options: Options | null;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${(error as Error).message}\n\n${USAGE}`);
    return 2;
  }

  if (options === null) {
    process.stdout.write(USAGE);
    return 0;
  }

  const results = new Map<string, readonly Finding[]>();
  for (const file of options.files) {
    try {
      results.set(file, await auditFile(file, options.minSeverity));
    } catch (error) {
      process.stderr.write(
        `cannot read ${file}: ${(error as Error).message}\n`,
      );
      return 2;
    }
  }

  for (const [file, findings] of results) {
    const render =
      options.format === "json"
        ? renderJson
        : options.format === "markdown"
          ? renderMarkdown
          : renderTerminal;
    process.stdout.write(render(file, findings));
  }

  if (options.failOn === "never") return 0;
  const threshold = SEVERITY_RANK[options.failOn];
  const tripped = [...results.values()]
    .flat()
    .some((f) => SEVERITY_RANK[f.severity] <= threshold);
  return tripped ? 1 : 0;
};

process.exitCode = await main();
