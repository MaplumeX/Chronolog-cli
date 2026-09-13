import { readConfigFile, clearConfigFile, maskToken, resolveAuth, writeConfigFile, CliError } from "../config.js";
import { request } from "../client.js";
import { getFlag, noUnknownFlags, type ParsedArgs } from "../args.js";

export async function runAuth(args: ParsedArgs, sub: string): Promise<unknown> {
  switch (sub) {
    case "login":
      return authLogin(args);
    case "status":
      return authStatus();
    case "logout":
      return authLogout();
    case "register":
      return authRegister(args);
    default:
      throw new CliError(
        "USAGE",
        `未知子命令: auth ${sub}（允许: login, status, logout, register）`,
      );
  }
}

function authLogin(args: ParsedArgs): unknown {
  noUnknownFlags(args, ["url", "token"]);
  const url = getFlag(args, "url");
  const token = getFlag(args, "token");
  if (!url || !token) {
    throw new CliError("USAGE", "用法: chronolog auth login --url <url> --token <token>");
  }
  writeConfigFile({ url, token });
  return {
    ok: true,
    note: "已写入配置文件",
    url,
    tokenMasked: maskToken(token),
  };
}

async function authStatus(): Promise<unknown> {
  const auth = resolveAuth();
  const me = (await request(auth.url, auth.token, "/api/auth/me")) as {
    id: string;
    username: string;
    displayName: string | null;
    timezone: string | null;
    continuousTiming: boolean;
  };
  return {
    url: auth.url,
    source: auth.source,
    tokenMasked: maskToken(auth.token),
    user: me,
  };
}

function authLogout(): unknown {
  const file = readConfigFile();
  if (file.url || file.token) {
    clearConfigFile();
    return { ok: true, removed: true };
  }
  return { ok: true, removed: false, note: "配置文件中没有认证信息" };
}

async function authRegister(args: ParsedArgs): Promise<unknown> {
  noUnknownFlags(args, ["url", "username", "password"]);
  const url = getFlag(args, "url");
  const username = requirePositionalOrFlag(args, "username");
  const password = requirePositionalOrFlag(args, "password");
  if (!url || !username || !password) {
    throw new CliError(
      "USAGE",
      "用法: chronolog auth register --url <url> --username <u> --password <p>",
    );
  }
  return request(url, "", "/api/auth/register", {
    method: "POST",
    body: { username, password },
  });
}

function requirePositionalOrFlag(args: ParsedArgs, name: string): string | undefined {
  return getFlag(args, name);
}