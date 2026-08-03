import type { SourceLine } from "./types.ts";

/**
 * Pine has no block comments, so a per-line scan is sufficient. Blanked regions
 * are replaced with spaces rather than removed so every column index still lines
 * up with `raw` — rules report positions against the original source.
 */
export const lex = (source: string): readonly SourceLine[] =>
  source.split(/\r?\n/).map((raw, index) => ({
    n: index + 1,
    raw,
    code: scrub(raw, true),
    codeWithStrings: scrub(raw, false),
  }));

const scrub = (raw: string, blankStrings: boolean): string => {
  const out = raw.split("");
  let quote: string | null = null;

  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i] as string;

    if (quote !== null) {
      if (blankStrings) out[i] = " ";
      if (ch === "\\") {
        if (blankStrings && i + 1 < raw.length) out[i + 1] = " ";
        i += 1;
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      quote = ch;
      if (blankStrings) out[i] = " ";
      continue;
    }

    if (ch === "/" && raw[i + 1] === "/") {
      for (let j = i; j < raw.length; j += 1) out[j] = " ";
      break;
    }
  }

  return out.join("");
};

export const joinedCode = (lines: readonly SourceLine[]): string =>
  lines.map((l) => l.code).join("\n");

export const joinedCodeWithStrings = (lines: readonly SourceLine[]): string =>
  lines.map((l) => l.codeWithStrings).join("\n");

export const lineOf = (
  lines: readonly SourceLine[],
  offset: number,
): number => {
  let cursor = 0;
  for (const line of lines) {
    cursor += line.code.length + 1;
    if (offset < cursor) return line.n;
  }
  return lines.length > 0 ? (lines[lines.length - 1] as SourceLine).n : 1;
};
