import { CliError } from "../config.js";

/** 本机 IANA 时区（如 Asia/Shanghai） */
export function localTz(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** 组装 query：tz 默认取本机时区，--tz 覆盖；undefined 值剔除 */
export function queryWithTz(
  args: { flags: Record<string, unknown> },
  extra: Record<string, string | undefined>,
): Record<string, string> {
  const tzFlag = args.flags["tz"];
  const tz = typeof tzFlag === "string" && tzFlag.length > 0 ? tzFlag : localTz();
  const query: Record<string, string> = { tz };
  for (const [key, value] of Object.entries(extra)) {
    if (value !== undefined) query[key] = value;
  }
  return query;
}

/** 解析 --color："1"–"8" → number；"none"/"null" → null（清除）；其他 → USAGE */
export function parseColor(value: string): number | null {
  if (value === "none" || value === "null") return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 8) {
    throw new CliError("USAGE", `无效的 color："${value}"（应为 1–8、none 或 null）`);
  }
  return n;
}

/** 解析 --parent："none"/"root" → null（提升顶层）；否则原样返回 id */
export function parseParentId(value: string): string | null {
  if (value === "none" || value === "root") return null;
  return value;
}

/** 解析 --hours：正数；NaN 或 ≤0 → USAGE */
export function parseHours(value: string): number {
  const n = Number(value);
  if (Number.isNaN(n) || n <= 0) {
    throw new CliError("USAGE", `无效的 hours："${value}"（应为正数）`);
  }
  return n;
}

/** 枚举白名单校验，非法 → USAGE */
export function parseEnum<T extends string>(
  value: string,
  allowed: readonly T[],
  what: string,
): T {
  if ((allowed as readonly string[]).includes(value)) return value as T;
  throw new CliError("USAGE", `无效的 ${what}："${value}"（应为 ${allowed.join(" | ")}）`);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** YYYY-MM-DD 正则粗校验，精确校验交服务端；非法 → USAGE */
export function parseDateParam(value: string, what: string): string {
  if (!DATE_RE.test(value)) {
    throw new CliError("USAGE", `无效的 ${what}："${value}"（应为 YYYY-MM-DD）`);
  }
  return value;
}