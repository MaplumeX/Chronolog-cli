import { CliError } from "../config.js";
import { api } from "../api.js";
import { noUnknownFlags, type ParsedArgs } from "../args.js";
import { queryWithTz } from "./util.js";

export async function runStats(args: ParsedArgs, sub: string): Promise<unknown> {
  switch (sub) {
    case "today":
      return statsToday(args);
    default:
      throw new CliError("USAGE", `未知子命令: stats ${sub}（允许: today）`);
  }
}

async function statsToday(args: ParsedArgs): Promise<unknown> {
  noUnknownFlags(args, ["tz", "tag-id"]);
  const tagId = args.flags["tag-id"];
  return api("/api/stats/today", {
    query: queryWithTz(args, {
      tagId: typeof tagId === "string" ? tagId : undefined,
    }),
  });
}