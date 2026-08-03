import { joinedCode, joinedCodeWithStrings } from "./lexer.ts";
import type { AuditContext, DeclarationCall, SourceLine } from "./types.ts";

const EMPTY_DECLARATION: DeclarationCall = {
  found: false,
  line: 0,
  named: new Map(),
  positional: [],
  text: "",
};

/**
 * Locates `strategy(` / `indicator(` at the start of a logical line and balances
 * parens forward — the declaration routinely wraps across many lines.
 */
export const findDeclaration = (
  lines: readonly SourceLine[],
  fnName: string,
): DeclarationCall => {
  const opener = new RegExp(`^\\s*${fnName}\\s*\\(`);

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] as SourceLine;
    if (!opener.test(line.code)) continue;

    const start = line.code.indexOf("(");
    let depth = 0;
    let text = "";

    for (let j = i; j < lines.length; j += 1) {
      const scan = lines[j] as SourceLine;
      const from = j === i ? start : 0;

      for (let k = from; k < scan.code.length; k += 1) {
        const ch = scan.code[k] as string;
        if (ch === "(") depth += 1;
        if (ch === ")") {
          depth -= 1;
          if (depth === 0) {
            const args = splitArgs(text.slice(1));
            return {
              found: true,
              line: line.n,
              named: namedArgs(args),
              positional: args.filter((a) => !isNamed(a)).map(trim),
              text: `${text})`,
            };
          }
        }
        text += ch;
      }
      text += " ";
    }
  }

  return EMPTY_DECLARATION;
};

const splitArgs = (body: string): readonly string[] => {
  const parts: string[] = [];
  let depth = 0;
  let current = "";

  for (const ch of body) {
    if (ch === "(" || ch === "[") depth += 1;
    if (ch === ")" || ch === "]") depth -= 1;
    if (ch === "," && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim().length > 0) parts.push(current);
  return parts;
};

const isNamed = (arg: string): boolean => /^\s*[A-Za-z_]\w*\s*=[^=]/.test(arg);

const trim = (s: string): string => s.trim();

const namedArgs = (args: readonly string[]): ReadonlyMap<string, string> => {
  const map = new Map<string, string>();
  for (const arg of args) {
    if (!isNamed(arg)) continue;
    const eq = arg.indexOf("=");
    map.set(arg.slice(0, eq).trim(), arg.slice(eq + 1).trim());
  }
  return map;
};

const ENTRY_ID =
  /strategy\.(?:entry|order)\s*\(\s*(?:id\s*=\s*)?("?)([\w .-]+)\1/g;

const collectEntryIds = (code: string): ReadonlySet<string> => {
  const ids = new Set<string>();
  for (const match of code.matchAll(ENTRY_ID)) {
    const id = (match[2] ?? "").trim();
    if (id.length > 0) ids.add(id);
  }
  return ids;
};

export const buildContext = (
  filePath: string,
  lines: readonly SourceLine[],
): AuditContext => {
  const code = joinedCode(lines);
  const declaration = findDeclaration(lines, "strategy");

  return {
    filePath,
    lines,
    declaration,
    isStrategy: declaration.found,
    inputCount: [...code.matchAll(/\binput\s*\.\s*\w+\s*\(/g)].length,
    entryIds: collectEntryIds(joinedCodeWithStrings(lines)),
  };
};
