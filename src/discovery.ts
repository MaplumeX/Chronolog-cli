import { CliError } from "./config.js";
import { COMMANDS, commandsUnder, findCommand, rootNames, type CommandSpec } from "./catalog.js";
import { packageVersion } from "./version.js";

export type CliOutput =
  | { format: "json"; value: unknown }
  | { format: "text"; value: string };

const SUMMARY = "面向 AI agent 的 Chronolog JSON 命令行客户端";
const GROUP_SUMMARIES: Readonly<Record<string, string>> = {
  auth: "配置服务地址、注册、登录并管理本地认证",
  timer: "启动、停止、查看和编辑当前计时器",
  entries: "查询和管理时间记录",
  stats: "查询今日或指定时间范围的统计数据",
  goals: "查询和管理时间目标",
  categories: "查询和管理分类",
  tags: "查询和管理标签",
  tokens: "查询和管理 API 令牌",
  account: "查询和管理当前账户",
  health: "检查服务健康状态",
};

export function discoveryOutput(argv: string[]): CliOutput | undefined {
  if (argv.length === 1 && (argv[0] === "--version" || argv[0] === "-V")) {
    return { format: "text", value: `chronolog ${packageVersion()}` };
  }
  if (argv[0] === "version") {
    if (argv.length === 1) return { format: "text", value: `chronolog ${packageVersion()}` };
    if (argv.length === 2 && argv[1] === "--json") return { format: "json", value: versionInfo() };
    throw new CliError("USAGE", "用法: chronolog version [--json]");
  }
  if (argv.length === 1 && argv[0] === "capabilities") {
    return { format: "json", value: capabilities() };
  }
  if (argv[0] === "capabilities") {
    throw new CliError("USAGE", "用法: chronolog capabilities");
  }

  const helpIndex = argv.findIndex((arg) => arg === "--help" || arg === "-h");
  if (argv[0] === "help" || helpIndex !== -1) {
    return helpOutput(argv, helpIndex);
  }
  return undefined;
}

function helpOutput(argv: string[], helpIndex: number): CliOutput {
  let rest = argv[0] === "help" ? argv.slice(1) : argv.filter((_, index) => index !== helpIndex);
  const json = rest.includes("--json");
  rest = rest.filter((arg) => arg !== "--json");
  if (rest.some((arg) => arg.startsWith("-")) || rest.length > 2) {
    throw new CliError("USAGE", "用法: chronolog help [命令] [子命令] [--json]");
  }
  const info = helpInfo(rest);
  return json ? { format: "json", value: info } : { format: "text", value: renderHelp(info) };
}

export type HelpInfo =
  | { level: "root"; name: string; version: string; summary: string; usage: string[]; commands: { name: string; summary: string }[] }
  | { level: "group"; name: string; summary: string; usage: string; commands: CommandSpec[] }
  | { level: "command"; command: CommandSpec };

export function helpInfo(path: string[]): HelpInfo {
  if (path.length === 0) {
    return {
      level: "root",
      name: "chronolog",
      version: packageVersion(),
      summary: SUMMARY,
      usage: ["chronolog <命令> [参数]", "chronolog help [命令] [子命令] [--json]", "chronolog capabilities"],
      commands: rootNames().map((name) => ({ name, summary: GROUP_SUMMARIES[name] })),
    };
  }
  if (path.length === 1) {
    const commands = commandsUnder(path[0]);
    if (commands.length === 0) throw new CliError("USAGE", `未知命令: ${path[0]}`);
    if (commands.length === 1 && commands[0].path.length === 1) {
      return { level: "command", command: commands[0] };
    }
    return {
      level: "group",
      name: path[0],
      summary: GROUP_SUMMARIES[path[0]],
      usage: `chronolog ${path[0]} <子命令> [参数]`,
      commands,
    };
  }
  const command = findCommand(path);
  if (!command) throw new CliError("USAGE", `未知命令: ${path.join(" ")}`);
  return { level: "command", command };
}

function renderHelp(info: HelpInfo): string {
  if (info.level === "root") {
    const rows = info.commands.map((command) => `  ${command.name.padEnd(12)} ${command.summary}`).join("\n");
    return `${info.name} ${info.version}\n\n${info.summary}\n\n用法:\n${info.usage.map((line) => `  ${line}`).join("\n")}\n\n命令:\n${rows}\n\n运行 chronolog help <命令> 查看详细帮助。`;
  }
  if (info.level === "group") {
    const rows = info.commands.map((command) => `  ${command.path.at(-1)!.padEnd(12)} ${command.summary}`).join("\n");
    return `${info.name} — ${info.summary}\n\n用法:\n  ${info.usage}\n\n子命令:\n${rows}`;
  }
  const command = info.command;
  const positionalRows = command.positionals.map((item) => `  <${item.name}>${item.required ? " (必填)" : ""}  ${item.description}`);
  const flagRows = command.flags.map((item) => {
    const value = item.kind === "boolean" ? "" : ` <${item.value ?? "value"}>`;
    const repeat = item.kind === "repeatable-string" ? "（可重复）" : "";
    return `  --${item.name}${value}${item.required ? " (必填)" : ""}  ${item.description}${repeat}`;
  });
  const sections = [`${command.path.join(" ")} — ${command.summary}`, `用法:\n  ${command.usage}`];
  if (positionalRows.length > 0) sections.push(`位置参数:\n${positionalRows.join("\n")}`);
  if (flagRows.length > 0) sections.push(`选项:\n${flagRows.join("\n")}`);
  sections.push(`认证: ${command.auth ? "需要" : "不需要"}`, `操作类型: ${command.operation}`);
  return sections.join("\n\n");
}

export function versionInfo(): { name: string; version: string } {
  return { name: "chronolog", version: packageVersion() };
}

export function capabilities(): unknown {
  return {
    ...versionInfo(),
    output: {
      operationalSuccess: "single-json-object",
      operationalError: "single-json-error-object",
      humanDiscovery: ["--help", "help", "--version", "version"],
      structuredDiscovery: ["help --json", "version --json", "capabilities"],
    },
    commands: COMMANDS,
  };
}
