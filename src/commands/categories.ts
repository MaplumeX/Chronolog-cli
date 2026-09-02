import { CliError } from "../config.js";
import { api } from "../api.js";
import { getFlag, noUnknownFlags, requirePositional, getFlagBoolean, type ParsedArgs } from "../args.js";
import { parseColor, parseParentId } from "./util.js";

export async function runCategories(args: ParsedArgs, sub: string): Promise<unknown> {
  switch (sub) {
    case "list":
      return categoriesList(args);
    case "add":
      return categoriesAdd(args);
    case "rename":
      return categoriesRename(args);
    case "delete":
      return categoriesDelete(args);
    case "archive":
      return categoriesArchive(args);
    case "unarchive":
      return categoriesUnarchive(args);
    default:
      throw new CliError(
        "USAGE",
        `未知子命令: categories ${sub}（允许: list, add, rename, delete, archive, unarchive）`,
      );
  }
}

function nameOf(args: ParsedArgs, what: string): string {
  const name = requirePositional(args, 0, what).trim();
  if (name.length === 0) throw new CliError("USAGE", `${what}不能为空`);
  return name;
}

function categoriesList(args: ParsedArgs): Promise<unknown> {
  noUnknownFlags(args, []);
  return api("/api/categories");
}

async function categoriesAdd(args: ParsedArgs): Promise<unknown> {
  noUnknownFlags(args, ["color", "parent"]);
  const name = nameOf(args, "分类名");
  const body: Record<string, unknown> = { name };
  const color = getFlag(args, "color");
  if (color !== undefined) body["color"] = parseColor(color);
  const parent = getFlag(args, "parent");
  if (parent !== undefined) body["parentId"] = parseParentId(parent);
  return api("/api/categories", { method: "POST", body });
}

async function categoriesRename(args: ParsedArgs): Promise<unknown> {
  noUnknownFlags(args, ["name", "color", "parent"]);
  const id = requirePositional(args, 0, "分类 id");
  const name = getFlag(args, "name");
  const color = getFlag(args, "color");
  const parent = getFlag(args, "parent");
  if (name === undefined && color === undefined && parent === undefined) {
    throw new CliError(
      "USAGE",
      "用法: chronolog categories rename <id> [--name <n>] [--color <1-8|none>] [--parent <id|none|root>]（至少提供一个字段）",
    );
  }
  const body: Record<string, unknown> = {};
  if (name !== undefined) {
    const trimmed = name.trim();
    if (trimmed.length === 0) throw new CliError("USAGE", "新分类名不能为空");
    body["name"] = trimmed;
  }
  if (color !== undefined) body["color"] = parseColor(color);
  if (parent !== undefined) body["parentId"] = parseParentId(parent);
  return api(`/api/categories/${id}`, { method: "PATCH", body });
}

async function categoriesDelete(args: ParsedArgs): Promise<unknown> {
  noUnknownFlags(args, []);
  const id = requirePositional(args, 0, "分类 id");
  return api(`/api/categories/${id}`, { method: "DELETE" });
}

async function categoriesArchive(args: ParsedArgs): Promise<unknown> {
  noUnknownFlags(args, []);
  const id = requirePositional(args, 0, "分类 id");
  return api(`/api/categories/${id}/archive`, { method: "POST" });
}

async function categoriesUnarchive(args: ParsedArgs): Promise<unknown> {
  noUnknownFlags(args, []);
  const id = requirePositional(args, 0, "分类 id");
  return api(`/api/categories/${id}/unarchive`, { method: "POST" });
}
