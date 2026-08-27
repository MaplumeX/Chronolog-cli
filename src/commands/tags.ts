import { CliError } from "../config.js";
import { api } from "../api.js";
import { requirePositional, type ParsedArgs } from "../args.js";

export async function runTags(args: ParsedArgs, sub: string): Promise<unknown> {
  switch (sub) {
    case "list":
      return api("/api/tags");
    case "add":
      return tagsAdd(args);
    case "rename":
      return tagsRename(args);
    case "delete":
      return tagsDelete(args);
    default:
      throw new CliError("USAGE", `未知子命令: tags ${sub}（允许: list, add, rename, delete）`);
  }
}

function nameOf(args: ParsedArgs, what: string): string {
  const name = requirePositional(args, 0, what).trim();
  if (name.length === 0) throw new CliError("USAGE", `${what}不能为空`);
  return name;
}

async function tagsAdd(args: ParsedArgs): Promise<unknown> {
  const name = nameOf(args, "标签名");
  return api("/api/tags", { method: "POST", body: { name } });
}

async function tagsRename(args: ParsedArgs): Promise<unknown> {
  const id = requirePositional(args, 0, "标签 id");
  const name = requirePositional(args, 1, "新标签名").trim();
  if (name.length === 0) throw new CliError("USAGE", "新标签名不能为空");
  return api(`/api/tags/${id}`, { method: "PATCH", body: { name } });
}

async function tagsDelete(args: ParsedArgs): Promise<unknown> {
  const id = requirePositional(args, 0, "标签 id");
  return api(`/api/tags/${id}`, { method: "DELETE" });
}