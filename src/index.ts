#!/usr/bin/env node
import { CliError } from "./config.js";
import { ApiError } from "./client.js";
import { parseArgs } from "./args.js";
import { runAuth } from "./commands/auth.js";
import { runTimer } from "./commands/timer.js";
import { runEntries } from "./commands/entries.js";
import { runStats } from "./commands/stats.js";
import { runCategories } from "./commands/categories.js";
import { runTags } from "./commands/tags.js";
import { runTokens } from "./commands/tokens.js";

async function dispatch(): Promise<unknown> {
  const args = parseArgs(process.argv.slice(2));
  const [root, sub] = args.command;
  if (sub === undefined) {
    throw new CliError("USAGE", `缺少子命令。可用命令: auth, timer, entries, stats, categories, tags, tokens`);
  }
  switch (root) {
    case "auth":
      return runAuth(args, sub);
    case "timer":
      return runTimer(args, sub);
    case "entries":
      return runEntries(args, sub);
    case "stats":
      return runStats(args, sub);
    case "categories":
      return runCategories(args, sub);
    case "tags":
      return runTags(args, sub);
    case "tokens":
      return runTokens(args, sub);
    default:
      throw new CliError(
        "USAGE",
        `未知命令: ${root}（可用: auth, timer, entries, stats, categories, tags, tokens）`,
      );
  }
}

async function main(): Promise<void> {
  try {
    const result = await dispatch();
    process.stdout.write(JSON.stringify(result) + "\n");
    process.exitCode = 0;
  } catch (err) {
    let code = "UNKNOWN";
    let message = "未知错误";
    if (err instanceof CliError || err instanceof ApiError) {
      code = err.code;
      message = err.message;
    } else if (err instanceof Error) {
      code = "INTERNAL";
      message = err.message;
    }
    process.stdout.write(JSON.stringify({ error: { code, message } }) + "\n");
    process.stderr.write(`chronolog: [${code}] ${message}\n`);
    process.exitCode = 1;
  }
}

await main();