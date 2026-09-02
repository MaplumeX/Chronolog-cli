import { CliError } from "../config.js";
import { api } from "../api.js";
import { getFlag, getFlagArray, noUnknownFlags, type ParsedArgs } from "../args.js";
import { resolveCategory, resolveTags } from "../resolve.js";

export async function runTimer(args: ParsedArgs, sub: string): Promise<unknown> {
  switch (sub) {
    case "start":
      return timerStart(args);
    case "status":
      return timerStatus(args);
    case "stop":
      return timerStop(args);
    case "edit":
      return timerEdit(args);
    default:
      throw new CliError("USAGE", `未知子命令: timer ${sub}（允许: start, status, stop, edit）`);
  }
}

async function timerStart(args: ParsedArgs): Promise<unknown> {
  noUnknownFlags(args, ["category", "description", "tag"]);
  const category = getFlag(args, "category");
  if (!category) {
    throw new CliError("USAGE", "用法: chronolog timer start --category <id|名称> [--description <文本>] [--tag <id|名称>...]");
  }
  const categoryId = await resolveCategory(category);
  const tagIds = await resolveTags(getFlagArray(args, "tag"));
  const description = getFlag(args, "description");
  const body: Record<string, unknown> = { categoryId, tagIds };
  if (description !== undefined) body["description"] = description;
  return api("/api/timer/start", { method: "POST", body });
}

async function timerStatus(args: ParsedArgs): Promise<unknown> {
  noUnknownFlags(args, []);
  return api("/api/timer/current");
}

async function timerStop(args: ParsedArgs): Promise<unknown> {
  noUnknownFlags(args, []);
  return api("/api/timer/stop", { method: "POST" });
}

async function timerEdit(args: ParsedArgs): Promise<unknown> {
  noUnknownFlags(args, ["category", "description", "tag"]);
  const category = getFlag(args, "category");
  const description = getFlag(args, "description");
  const tagValues = getFlagArray(args, "tag");
  if (category === undefined && description === undefined && tagValues.length === 0) {
    throw new CliError(
      "USAGE",
      "用法: chronolog timer edit [--description <文本>] [--category <id|名称>] [--tag <id|名称>...]（至少提供一个字段）",
    );
  }
  const body: Record<string, unknown> = {};
  if (description !== undefined) body["description"] = description;
  if (category !== undefined) body["categoryId"] = await resolveCategory(category);
  if (tagValues.length > 0) body["tagIds"] = await resolveTags(tagValues);
  return api("/api/timer/current", { method: "PATCH", body });
}