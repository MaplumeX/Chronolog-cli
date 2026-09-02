import { CliError, AUTH_MISSING_HINT, resolveUrlLoose } from "../config.js";
import { request } from "../client.js";
import { getFlag, noUnknownFlags, type ParsedArgs } from "../args.js";

/** GET /api/health — 无认证健康检查（--url 覆盖，否则宽松读取配置） */
export async function runHealth(args: ParsedArgs): Promise<unknown> {
  noUnknownFlags(args, ["url"]);
  const url = getFlag(args, "url") ?? resolveUrlLoose();
  if (!url) {
    throw new CliError("AUTH_MISSING", AUTH_MISSING_HINT);
  }
  return request(url, "", "/api/health");
}
