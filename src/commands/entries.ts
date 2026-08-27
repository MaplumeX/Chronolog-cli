import { CliError } from "../config.js";
import { api } from "../api.js";
import { getFlag, getFlagBoolean, noUnknownFlags, requirePositional, getFlagArray, type ParsedArgs } from "../args.js";
import { resolveCategory, resolveTags } from "../resolve.js";
import { queryWithTz } from "./util.js";

export async function runEntries(args: ParsedArgs, sub: string): Promise<unknown> {
  switch (sub) {
    case "list":
      return entriesList(args);
    case "update":
      return entriesUpdate(args);
    default:
      throw new CliError("USAGE", `未知子命令: entries ${sub}（允许: list, update）`);
  }
}

async function entriesList(args: ParsedArgs): Promise<unknown> {
  noUnknownFlags(args, ["today", "week", "date", "tag-id", "tz"]);
  const today = getFlagBoolean(args, "today");
  const week = getFlagBoolean(args, "week");
  if (today === week) {
    throw new CliError("USAGE", "用法: chronolog entries list --today | --week [--date <YYYY-MM-DD>] [--tag-id <id>] [--tz <tz>]");
  }
  const scope = today ? "today" : "week";
  const tagId = getFlag(args, "tag-id");
  if (tagId !== undefined && scope === "week") {
    throw new CliError("USAGE", "--tag-id 仅支持 --today");
  }
  let resolvedTagId: string | undefined;
  if (tagId !== undefined) {
    const tags = (await api("/api/tags")) as { tags: { id: string; name: string }[] };
    const match = tags.tags.filter((t) => t.name === tagId);
    resolvedTagId = match.length === 1 ? match[0].id : tagId;
  }
  return api(`/api/entries/${scope}`, {
    query: queryWithTz(args, { date: getFlag(args, "date"), tagId: resolvedTagId }),
  });
}
async function entriesUpdate(args: ParsedArgs): Promise<unknown> {
  noUnknownFlags(args, ["category", "description", "tag", "started-at", "stopped-at"]);
  const id = requirePositional(args, 0, "条目 id");
  const category = getFlag(args, "category");
  const description = getFlag(args, "description");
  const startedAt = getFlag(args, "started-at");
  const stoppedAt = getFlag(args, "stopped-at");
  if (!category || description === undefined || !startedAt || !stoppedAt) {
    throw new CliError(
      "USAGE",
      "用法: chronolog entries update <id> --category <id|名称> --description <文本> [--tag <id|名称>...] --started-at <iso> --stopped-at <iso>",
    );
  }
  const categoryId = await resolveCategory(category);
  const tagIds = await resolveTags(getFlagArray(args, "tag"));
  return api(`/api/entries/${id}`, {
    method: "PATCH",
    body: { description, categoryId, tagIds, startedAt, stoppedAt },
  });
}