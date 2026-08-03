import type { AuditContext, SourceLine } from "../types.ts";

export const argOf = (ctx: AuditContext, name: string): string | undefined =>
  ctx.declaration.named.get(name);

export const isExplicitlyTrue = (value: string | undefined): boolean =>
  value !== undefined && /^true$/i.test(value.trim());

/** Returns undefined for anything that is not a bare numeric literal (e.g. an input.* call). */
export const numericArg = (
  ctx: AuditContext,
  name: string,
): number | undefined => {
  const raw = argOf(ctx, name);
  if (raw === undefined) return undefined;
  const parsed = Number(raw.trim());
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const matchingLines = (
  ctx: AuditContext,
  pattern: RegExp,
): readonly { line: SourceLine; text: string }[] =>
  ctx.lines
    .filter((line) => pattern.test(line.code))
    .map((line) => ({ line, text: line.raw.trim().slice(0, 160) }));

export const declarationLine = (ctx: AuditContext): number =>
  ctx.declaration.found ? ctx.declaration.line : 1;
