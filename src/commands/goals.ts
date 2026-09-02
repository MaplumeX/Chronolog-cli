import { CliError } from "../config.js";
import { api } from "../api.js";
import { getFlag, noUnknownFlags, requirePositional, type ParsedArgs } from "../args.js";
import { resolveCategory, resolveTag } from "../resolve.js";
import { queryWithTz, parseHours, parseEnum, parseDateParam } from "./util.js";

const DIRECTIONS = ["lt", "gt"] as const;
const PERIOD_UNITS = ["day", "week", "month"] as const;

export async function runGoals(args: ParsedArgs, sub: string): Promise<unknown> {
  switch (sub) {
    case "list":
      return goalsList(args);
    case "add":
      return goalsAdd(args);
    case "update":
      return goalsUpdate(args);
    case "delete":
      return goalsDelete(args);
    default:
      throw new CliError("USAGE", `未知子命令: goals ${sub}（允许: list, add, update, delete）`);
  }
}

async function goalsList(args: ParsedArgs): Promise<unknown> {
  noUnknownFlags(args, ["tz"]);
  return api("/api/goals", { query: queryWithTz(args, {}) });
}

async function goalsAdd(args: ParsedArgs): Promise<unknown> {
  noUnknownFlags(args, ["icon", "category", "tag", "direction", "hours", "period", "due"]);
  const name = requirePositional(args, 0, "目标名").trim();
  if (name.length === 0) throw new CliError("USAGE", "目标名不能为空");
  const direction = getFlag(args, "direction");
  const hours = getFlag(args, "hours");
  const period = getFlag(args, "period");
  if (!direction || !hours || !period) {
    throw new CliError(
      "USAGE",
      "用法: chronolog goals add <name> [--icon <emoji>] [--category <id|名称>] [--tag <id|名称>] --direction <lt|gt> --hours <n> --period <day|week|month> [--due <YYYY-MM-DD>]",
    );
  }
  const body: Record<string, unknown> = {
    name,
    direction: parseEnum(direction, DIRECTIONS, "direction"),
    hours: parseHours(hours),
    periodUnit: parseEnum(period, PERIOD_UNITS, "period"),
  };
  const icon = getFlag(args, "icon");
  if (icon !== undefined) body["icon"] = icon;
  const category = getFlag(args, "category");
  if (category !== undefined) body["categoryId"] = await resolveCategory(category);
  const tag = getFlag(args, "tag");
  if (tag !== undefined) body["tagId"] = await resolveTag(tag);
  const due = getFlag(args, "due");
  if (due !== undefined) body["dueDate"] = parseDateParam(due, "due");
  return api("/api/goals", { method: "POST", body });
}

async function goalsUpdate(args: ParsedArgs): Promise<unknown> {
  noUnknownFlags(args, ["name", "icon", "category", "tag", "direction", "hours", "period", "due"]);
  const id = requirePositional(args, 0, "目标 id");
  const name = getFlag(args, "name");
  const icon = getFlag(args, "icon");
  const category = getFlag(args, "category");
  const tag = getFlag(args, "tag");
  const direction = getFlag(args, "direction");
  const hours = getFlag(args, "hours");
  const period = getFlag(args, "period");
  const due = getFlag(args, "due");
  if (
    name === undefined &&
    icon === undefined &&
    category === undefined &&
    tag === undefined &&
    direction === undefined &&
    hours === undefined &&
    period === undefined &&
    due === undefined
  ) {
    throw new CliError(
      "USAGE",
      "用法: chronolog goals update <id> [--name] [--icon] [--category] [--tag] [--direction] [--hours] [--period] [--due]（至少提供一个字段）",
    );
  }
  const body: Record<string, unknown> = {};
  if (name !== undefined) {
    const trimmed = name.trim();
    if (trimmed.length === 0) throw new CliError("USAGE", "目标名不能为空");
    body["name"] = trimmed;
  }
  if (icon !== undefined) body["icon"] = icon;
  if (category !== undefined) {
    // "none"/"null" 表示清除关联，其余值走名称解析
    body["categoryId"] = category === "none" || category === "null" ? null : await resolveCategory(category);
  }
  if (tag !== undefined) {
    body["tagId"] = tag === "none" || tag === "null" ? null : await resolveTag(tag);
  }
  if (direction !== undefined) body["direction"] = parseEnum(direction, DIRECTIONS, "direction");
  if (hours !== undefined) body["hours"] = parseHours(hours);
  if (period !== undefined) body["periodUnit"] = parseEnum(period, PERIOD_UNITS, "period");
  if (due !== undefined) body["dueDate"] = parseDateParam(due, "due");
  return api(`/api/goals/${id}`, { method: "PATCH", body });
}

async function goalsDelete(args: ParsedArgs): Promise<unknown> {
  noUnknownFlags(args, []);
  const id = requirePositional(args, 0, "目标 id");
  return api(`/api/goals/${id}`, { method: "DELETE" });
}
