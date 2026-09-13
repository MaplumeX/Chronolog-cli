import { CliError, AUTH_MISSING_HINT, resolveUrlLoose } from "../config.js";
import { request } from "../client.js";
import { getFlag, noUnknownFlags, type ParsedArgs } from "../args.js";
import { parseEnum } from "./util.js";
import { api } from "../api.js";

export async function runAccount(args: ParsedArgs, sub: string): Promise<unknown> {
  switch (sub) {
    case "profile":
      return accountProfile(args);
    case "password":
      return accountPassword(args);
    case "delete":
      return accountDelete(args);
    case "meta":
      return accountMeta(args);
    default:
      throw new CliError("USAGE", `未知子命令: account ${sub}（允许: profile, password, delete, meta）`);
  }
}

async function accountProfile(args: ParsedArgs): Promise<unknown> {
  noUnknownFlags(args, ["username", "display-name", "timezone", "continuous-timing"]);
  const username = getFlag(args, "username");
  const displayName = getFlag(args, "display-name");
  const timezone = getFlag(args, "timezone");
  const continuousTiming = getFlag(args, "continuous-timing");
  if (
    username === undefined &&
    displayName === undefined &&
    timezone === undefined &&
    continuousTiming === undefined
  ) {
    throw new CliError(
      "USAGE",
      "用法: chronolog account profile [--username <u>] [--display-name <n>] [--timezone <tz|none>] [--continuous-timing <true|false>]（至少提供一个字段）",
    );
  }
  const body: Record<string, unknown> = {};
  if (username !== undefined) body["username"] = username;
  if (displayName !== undefined) body["displayName"] = displayName; // 空串由服务端转为 null
  if (timezone !== undefined) {
    // none / 空串 → 清除（跟随浏览器）；IANA 名交服务端校验
    body["timezone"] = timezone === "none" ? "" : timezone;
  }
  if (continuousTiming !== undefined) {
    body["continuousTiming"] =
      parseEnum(continuousTiming, ["true", "false"] as const, "continuous-timing") === "true";
  }
  return api("/api/profile", { method: "PATCH", body });
}

async function accountPassword(args: ParsedArgs): Promise<unknown> {
  noUnknownFlags(args, ["current-password", "new-password"]);
  const currentPassword = getFlag(args, "current-password");
  const newPassword = getFlag(args, "new-password");
  if (!currentPassword || !newPassword) {
    throw new CliError(
      "USAGE",
      "用法: chronolog account password --current-password <p> --new-password <p>",
    );
  }
  return api("/api/account/password", {
    method: "PATCH",
    body: { currentPassword, newPassword },
  });
}

async function accountDelete(args: ParsedArgs): Promise<unknown> {
  noUnknownFlags(args, ["password"]);
  const password = getFlag(args, "password");
  if (!password) {
    throw new CliError("USAGE", "用法: chronolog account delete --password <p>");
  }
  return api("/api/account", { method: "DELETE", body: { password } });
}

async function accountMeta(args: ParsedArgs): Promise<unknown> {
  noUnknownFlags(args, []);
  const url = resolveUrlLoose();
  if (!url) {
    throw new CliError("AUTH_MISSING", AUTH_MISSING_HINT);
  }
  return request(url, "", "/api/meta");
}
