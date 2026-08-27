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
    default:
      throw new CliError("USAGE", `未知子命令: timer ${sub}（允许: start, status, stop）`);
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