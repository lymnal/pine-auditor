import type { Finding, Severity } from "./types.ts";

const ESC = String.fromCharCode(27);
const COLOR: Readonly<Record<Severity, string>> = {
  critical: `${ESC}[41;97m`,
  high: `${ESC}[31;1m`,
  medium: `${ESC}[33m`,
  low: `${ESC}[90m`,
};
const RESET = `${ESC}[0m`;
const DIM = `${ESC}[2m`;
const BOLD = `${ESC}[1m`;
const GREEN = `${ESC}[32;1m`;

const useColor = process.stdout.isTTY && process.env["NO_COLOR"] === undefined;
const paint = (text: string, code: string): string =>
  useColor ? `${code}${text}${RESET}` : text;

export const renderTerminal = (
  filePath: string,
  findings: readonly Finding[],
): string => {
  if (findings.length === 0) {
    return `${paint("PASS", GREEN)} ${filePath} — no deterministic backtest-integrity issues found.\n`;
  }

  const lines: string[] = [`\n${paint(filePath, BOLD)}`];

  for (const f of findings) {
    const tag = paint(` ${f.severity.toUpperCase()} `, COLOR[f.severity]);
    lines.push("");
    lines.push(
      `${tag} ${paint(f.id, BOLD)} ${f.title}  ${paint(`(line ${f.line})`, DIM)}`,
    );
    lines.push(`      ${paint(f.evidence, DIM)}`);
    lines.push(wrap(f.why, "      "));
    lines.push(wrap(`Fix: ${f.fix}`, "      "));
  }

  lines.push("");
  lines.push(summarize(findings));
  return `${lines.join("\n")}\n`;
};

const summarize = (findings: readonly Finding[]): string => {
  const counts = new Map<Severity, number>();
  for (const f of findings)
    counts.set(f.severity, (counts.get(f.severity) ?? 0) + 1);
  const parts = [...counts.entries()].map(([sev, n]) =>
    paint(`${n} ${sev}`, COLOR[sev]),
  );
  return `${paint(String(findings.length), BOLD)} finding(s): ${parts.join(", ")}`;
};

const wrap = (text: string, indent: string, width = 92): string => {
  const words = text.split(/\s+/);
  const out: string[] = [];
  let line = indent;

  for (const word of words) {
    if (line.length + word.length + 1 > width && line.trim().length > 0) {
      out.push(line);
      line = indent;
    }
    line += (line === indent ? "" : " ") + word;
  }
  if (line.trim().length > 0) out.push(line);
  return out.join("\n");
};

export const renderMarkdown = (
  filePath: string,
  findings: readonly Finding[],
): string => {
  const header = `# Backtest integrity audit\n\n\`${filePath}\`\n\n`;
  if (findings.length === 0) return `${header}No deterministic issues found.\n`;

  const body = findings
    .map(
      (f) =>
        `### ${f.severity.toUpperCase()} · ${f.id} — ${f.title}\n\n` +
        `**Line ${f.line}** · \`${f.evidence.replace(/`/g, "'")}\`\n\n` +
        `${f.why}\n\n**Fix:** ${f.fix}\n`,
    )
    .join("\n");

  return `${header}${findings.length} finding(s).\n\n${body}`;
};

export const renderJson = (
  filePath: string,
  findings: readonly Finding[],
): string =>
  `${JSON.stringify({ file: filePath, count: findings.length, findings }, null, 2)}\n`;
