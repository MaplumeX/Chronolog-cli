import { CliError } from "../config.js";
import { api } from "../api.js";
import { getFlag, getFlagBoolean, noUnknownFlags, type ParsedArgs } from "../args.js";
import { queryWithTz, parseDateParam } from "./util.js";

export async function runStats(args: ParsedArgs, sub: string): Promise<unknown> {
  switch (sub) {
    case "today":
      return statsToday(args);
    case "range":
      return statsRange(args);
    default:
      throw new CliError("USAGE", `未知子命令: stats ${sub}（允许: today, range）`);
  }
}

async function statsToday(args: ParsedArgs): Promise<unknown> {
  noUnknownFlags(args, ["tz", "tag-id", "rollup"]);
  const tagId = args.flags["tag-id"];
  return api("/api/stats/today", {
    query: queryWithTz(args, {
      tagId: typeof tagId === "string" ? tagId : undefined,
      rollup: getFlagBoolean(args, "rollup") ? "true" : undefined,
    }),
  });
}

async function statsRange(args: ParsedArgs): Promise<unknown> {
  noUnknownFlags(args, ["from", "to", "tag-id", "rollup", "tz"]);
  const from = getFlag(args, "from");
  const to = getFlag(args, "to");
  if (!from || !to) {
    throw new CliError(
      "USAGE",
      "用法: chronolog stats range --from <YYYY-MM-DD> --to <YYYY-MM-DD> [--tag-id <id>] [--rollup] [--tz <tz>]",
    );
  }
  return api("/api/stats/range", {
    query: queryWithTz(args, {
      from: parseDateParam(from, "from"),
      to: parseDateParam(to, "to"),
      tagId: getFlag(args, "tag-id"),
      rollup: getFlagBoolean(args, "rollup") ? "true" : undefined,
    }),
  });
}