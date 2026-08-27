import { CliError } from "../config.js";
import { api } from "../api.js";
import { requirePositional, type ParsedArgs } from "../args.js";

export async function runCategories(args: ParsedArgs, sub: string): Promise<unknown> {
  switch (sub) {
    case "list":
      return api("/api/categories");
    case "add":
      return categoriesAdd(args);
    case "rename":
      return categoriesRename(args);
    case "delete":
      return categoriesDelete(args);
    default:
      throw new CliError("USAGE", `未知子命令: categories ${sub}（允许: list, add, rename, delete）`);
  }
}

function nameOf(args: ParsedArgs, what: string): string {
  const name = requirePositional(args, 0, what).trim();
  if (name.length === 0) throw new CliError("USAGE", `${what}不能为空`);
  return name;
}

async function categoriesAdd(args: ParsedArgs): Promise<unknown> {
  const name = nameOf(args, "分类名");
  return api("/api/categories", { method: "POST", body: { name } });
}

async function categoriesRename(args: ParsedArgs): Promise<unknown> {
  const id = requirePositional(args, 0, "分类 id");
  const name = requirePositional(args, 1, "新分类名").trim();
  if (name.length === 0) throw new CliError("USAGE", "新分类名不能为空");
  return api(`/api/categories/${id}`, { method: "PATCH", body: { name } });
}

async function categoriesDelete(args: ParsedArgs): Promise<unknown> {
  const id = requirePositional(args, 0, "分类 id");
  return api(`/api/categories/${id}`, { method: "DELETE" });
}