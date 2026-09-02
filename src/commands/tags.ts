import { CliError } from "../config.js";
import { api } from "../api.js";
import { getFlag, noUnknownFlags, requirePositional, type ParsedArgs } from "../args.js";
import { parseColor, parseParentId } from "./util.js";

export async function runTags(args: ParsedArgs, sub: string): Promise<unknown> {
  switch (sub) {
    case "list":
      return tagsList(args);
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

function tagsList(args: ParsedArgs): Promise<unknown> {
  noUnknownFlags(args, []);
  return api("/api/tags");
}

async function tagsAdd(args: ParsedArgs): Promise<unknown> {
  noUnknownFlags(args, ["color", "parent"]);
  const name = nameOf(args, "标签名");
  const body: Record<string, unknown> = { name };
  const color = getFlag(args, "color");
  if (color !== undefined) body["color"] = parseColor(color);
  const parent = getFlag(args, "parent");
  if (parent !== undefined) body["parentId"] = parseParentId(parent);
  return api("/api/tags", { method: "POST", body });
}

async function tagsRename(args: ParsedArgs): Promise<unknown> {
  noUnknownFlags(args, ["name", "color", "parent"]);
  const id = requirePositional(args, 0, "标签 id");
  const name = getFlag(args, "name");
  const color = getFlag(args, "color");
  const parent = getFlag(args, "parent");
  if (name === undefined && color === undefined && parent === undefined) {
    throw new CliError(
      "USAGE",
      "用法: chronolog tags rename <id> [--name <n>] [--color <1-8|none>] [--parent <id|none|root>]（至少提供一个字段）",
    );
  }
  const body: Record<string, unknown> = {};
  if (name !== undefined) {
    const trimmed = name.trim();
    if (trimmed.length === 0) throw new CliError("USAGE", "新标签名不能为空");
    body["name"] = trimmed;
  }
  if (color !== undefined) body["color"] = parseColor(color);
  if (parent !== undefined) body["parentId"] = parseParentId(parent);
  return api(`/api/tags/${id}`, { method: "PATCH", body });
}

async function tagsDelete(args: ParsedArgs): Promise<unknown> {
  noUnknownFlags(args, []);
  const id = requirePositional(args, 0, "标签 id");
  return api(`/api/tags/${id}`, { method: "DELETE" });
}
