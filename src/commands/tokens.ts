import { CliError } from "../config.js";
import { api } from "../api.js";
import { requirePositional, type ParsedArgs } from "../args.js";

export async function runTokens(args: ParsedArgs, sub: string): Promise<unknown> {
  switch (sub) {
    case "list":
      return api("/api/tokens");
    case "create":
      return tokensCreate(args);
    case "delete":
      return tokensDelete(args);
    default:
      throw new CliError("USAGE", `未知子命令: tokens ${sub}（允许: list, create, delete）`);
  }
}

async function tokensCreate(args: ParsedArgs): Promise<unknown> {
  const name = requirePositional(args, 0, "token 名称").trim();
  if (name.length === 0) throw new CliError("USAGE", "token 名称不能为空");
  return api("/api/tokens", { method: "POST", body: { name } });
}

async function tokensDelete(args: ParsedArgs): Promise<unknown> {
  const id = requirePositional(args, 0, "token id");
  return api(`/api/tokens/${id}`, { method: "DELETE" });
}