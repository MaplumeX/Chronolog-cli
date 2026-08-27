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