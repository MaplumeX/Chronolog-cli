import { CliError } from "./config.js";

export type ParsedArgs = {
  /** 命令路径，如 ["timer", "start"] */
  command: string[];
  /** 字符串 flags（重复 flag 聚合成数组） */
  flags: Record<string, string | string[] | boolean>;
  /** 位置参数 */
  positional: string[];
};

/**
 * 解析 argv：
 * - 开头连续的非 flag 段为命令路径（如 `timer start`）
 * - `--flag value`、`--flag=value`、裸 `--flag`（布尔 true）
 * - 重复 flag 聚合成 string[]
 */
export function parseArgs(argv: string[]): ParsedArgs {
  const command: string[] = [];
  const flags: Record<string, string | string[] | boolean> = {};
  const positional: string[] = [];

  let i = 0;
  // 前两个非 flag 段为命令路径（root sub），后续非 flag 段为位置参数
  while (i < argv.length && !argv[i].startsWith("--") && command.length < 2) {
    command.push(argv[i]);
    i++;
  }
  if (command.length === 0) {
    throw new CliError("USAGE", "缺少命令。用法示例: chronolog timer status");
  }

  for (; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const eq = arg.indexOf("=");
      if (eq === -1) {
        const name = flagName(arg);
        // 裸 --flag 先视为布尔，若下一段不是 flag 则作为其值
        if (i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
          pushFlag(flags, name, argv[i + 1]);
          i++;
        } else {
          pushFlag(flags, name, true);
        }
      } else {
        pushFlag(flags, flagName(arg.slice(0, eq)), arg.slice(eq + 1));
      }
    } else {
      positional.push(arg);
    }
  }
  return { command, flags, positional };
}

function flagName(raw: string): string {
  const name = raw.slice(2);
  if (name.length === 0) throw new CliError("USAGE", `无效参数: ${raw}`);
  return name;
}

function pushFlag(
  flags: Record<string, string | string[] | boolean>,
  name: string,
  value: string | boolean,
): void {
  const existing = flags[name];
  if (existing === undefined || existing === true) {
    flags[name] = value;
  } else if (typeof existing === "string" || typeof value === "boolean") {
    flags[name] = [String(existing), String(value)];
  } else if (Array.isArray(existing)) {
    existing.push(String(value));
  }
}

export function getFlag(args: ParsedArgs, name: string): string | undefined {
  const v = args.flags[name];
  if (typeof v === "string") return v;
  return undefined;
}

export function getFlagArray(args: ParsedArgs, name: string): string[] {
  const v = args.flags[name];
  if (v === undefined) return [];
  if (typeof v === "string") return [v];
  if (Array.isArray(v)) return v.map(String);
  return [];
}

export function getFlagBoolean(args: ParsedArgs, name: string): boolean {
  return args.flags[name] === true || typeof args.flags[name] === "string";
}

export function requirePositional(args: ParsedArgs, index: number, what: string): string {
  const v = args.positional[index];
  if (v === undefined) {
    throw new CliError("USAGE", `缺少参数: ${what}`);
  }
  return v;
}

export function noUnknownFlags(
  args: ParsedArgs,
  allowed: string[],
): void {
  for (const name of Object.keys(args.flags)) {
    if (!allowed.includes(name)) {
      throw new CliError("USAGE", `未知参数: --${name}（允许: ${allowed.map((f) => `--${f}`).join(", ")}）`);
    }
  }
}