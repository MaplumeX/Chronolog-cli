import { CliError } from "./config.js";
import { findCommand, type CommandSpec } from "./catalog.js";

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

  const spec = findCommand(command);

  for (; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const eq = arg.indexOf("=");
      const name = flagName(eq === -1 ? arg : arg.slice(0, eq));
      const flagSpec = spec?.flags.find((candidate) => candidate.name === name);
      if (spec && !flagSpec) unknownFlag(spec, name);
      if (flagSpec) {
        if (flags[name] !== undefined && flagSpec.kind !== "repeatable-string") {
          throw new CliError("USAGE", `参数不可重复: --${name}`);
        }
        if (flagSpec.kind === "boolean") {
          if (eq !== -1) throw new CliError("USAGE", `布尔参数不接受值: --${name}`);
          pushFlag(flags, name, true);
          continue;
        }
        if (eq !== -1) {
          pushFlag(flags, name, arg.slice(eq + 1));
          continue;
        }
        if (i + 1 >= argv.length || argv[i + 1].startsWith("--")) {
          throw new CliError("USAGE", `参数缺少值: --${name}`);
        }
        pushFlag(flags, name, argv[++i]);
        continue;
      }

      // 未知命令仍按旧规则解析，让 dispatcher 返回更准确的命令错误。
      if (eq !== -1) pushFlag(flags, name, arg.slice(eq + 1));
      else if (i + 1 < argv.length && !argv[i + 1].startsWith("--")) pushFlag(flags, name, argv[++i]);
      else pushFlag(flags, name, true);
    } else {
      positional.push(arg);
    }
  }
  const parsed = { command, flags, positional };
  if (spec) validateShape(parsed, spec);
  return parsed;
}

function unknownFlag(spec: CommandSpec, name: string): never {
  const allowed = spec.flags.map((item) => `--${item.name}`).join(", ");
  throw new CliError("USAGE", `未知参数: --${name}${allowed ? `（允许: ${allowed}）` : ""}`);
}

function validateShape(args: ParsedArgs, spec: CommandSpec): void {
  const requiredPositionals = spec.positionals.filter((item) => item.required).length;
  if (args.positional.length < requiredPositionals) {
    const missing = spec.positionals[args.positional.length];
    throw new CliError("USAGE", `缺少参数: ${missing?.description ?? "位置参数"}`);
  }
  if (args.positional.length > spec.positionals.length) {
    throw new CliError("USAGE", `多余参数: ${args.positional.slice(spec.positionals.length).join(" ")}`);
  }
  const missingFlags = spec.flags
    .filter((item) => item.required && args.flags[item.name] === undefined)
    .map((item) => `--${item.name}`);
  if (missingFlags.length > 0) {
    throw new CliError("USAGE", `缺少必填参数: ${missingFlags.join(", ")}。用法: ${spec.usage}`);
  }
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
