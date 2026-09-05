export type FlagKind = "string" | "boolean" | "repeatable-string";
export type OperationKind = "read" | "write" | "destructive" | "local";

export type FlagSpec = {
  name: string;
  kind: FlagKind;
  value?: string;
  required?: boolean;
  description: string;
};

export type PositionalSpec = {
  name: string;
  required: boolean;
  description: string;
};

export type CommandSpec = {
  path: string[];
  summary: string;
  usage: string;
  auth: boolean;
  operation: OperationKind;
  positionals: PositionalSpec[];
  flags: FlagSpec[];
  errors: string[];
};

const flag = (
  name: string,
  kind: FlagKind,
  description: string,
  options: { value?: string; required?: boolean } = {},
): FlagSpec => ({ name, kind, description, ...options });

const positional = (name: string, description: string): PositionalSpec => ({
  name,
  required: true,
  description,
});

const AUTH_ERRORS = ["AUTH_MISSING", "UNAUTHORIZED", "NETWORK"];
const WRITE_ERRORS = [...AUTH_ERRORS, "VALIDATION", "NOT_FOUND", "CONFLICT"];

export const COMMANDS: CommandSpec[] = [
  {
    path: ["auth", "login"], summary: "保存服务地址和访问令牌", usage: "chronolog auth login --url <url> --token <token>",
    auth: false, operation: "local", positionals: [],
    flags: [flag("url", "string", "Chronolog 服务地址", { value: "url", required: true }), flag("token", "string", "Personal access token", { value: "token", required: true })],
    errors: ["USAGE", "INTERNAL"],
  },
  {
    path: ["auth", "status"], summary: "检查认证配置和当前用户", usage: "chronolog auth status",
    auth: true, operation: "read", positionals: [], flags: [], errors: AUTH_ERRORS,
  },
  {
    path: ["auth", "logout"], summary: "删除配置文件中的认证信息", usage: "chronolog auth logout",
    auth: false, operation: "local", positionals: [], flags: [], errors: ["INTERNAL"],
  },
  {
    path: ["auth", "register"], summary: "注册账号（服务端可选功能）", usage: "chronolog auth register --url <url> --username <u> --password <p>",
    auth: false, operation: "write", positionals: [],
    flags: [flag("url", "string", "Chronolog 服务地址", { value: "url", required: true }), flag("username", "string", "用户名", { value: "username", required: true }), flag("password", "string", "密码", { value: "password", required: true })],
    errors: ["USAGE", "NETWORK", "VALIDATION", "CONFLICT"],
  },
  {
    path: ["timer", "start"], summary: "启动计时器", usage: "chronolog timer start --category <id|名称> [--description <文本>] [--tag <id|名称>...]",
    auth: true, operation: "write", positionals: [],
    flags: [flag("category", "string", "分类 ID 或精确名称", { value: "id|名称", required: true }), flag("description", "string", "描述", { value: "文本" }), flag("tag", "repeatable-string", "标签 ID 或精确名称", { value: "id|名称" })],
    errors: WRITE_ERRORS,
  },
  {
    path: ["timer", "status"], summary: "读取当前计时器", usage: "chronolog timer status",
    auth: true, operation: "read", positionals: [], flags: [], errors: AUTH_ERRORS,
  },
  {
    path: ["timer", "stop"], summary: "停止当前计时器", usage: "chronolog timer stop",
    auth: true, operation: "write", positionals: [], flags: [], errors: WRITE_ERRORS,
  },
  {
    path: ["timer", "edit"], summary: "编辑当前计时器", usage: "chronolog timer edit [--description <文本>] [--category <id|名称>] [--tag <id|名称>...]",
    auth: true, operation: "write", positionals: [],
    flags: [flag("description", "string", "描述", { value: "文本" }), flag("category", "string", "分类 ID 或精确名称", { value: "id|名称" }), flag("tag", "repeatable-string", "完整替换标签", { value: "id|名称" })],
    errors: WRITE_ERRORS,
  },
  {
    path: ["entries", "list"], summary: "列出当天或本周条目", usage: "chronolog entries list (--today | --week) [--date <YYYY-MM-DD>] [--tag-id <id>] [--tz <tz>]",
    auth: true, operation: "read", positionals: [],
    flags: [flag("today", "boolean", "查询当天"), flag("week", "boolean", "查询本周"), flag("date", "string", "查询基准日期", { value: "YYYY-MM-DD" }), flag("tag-id", "string", "当天查询的标签 ID 或名称", { value: "id|名称" }), flag("tz", "string", "IANA 时区", { value: "tz" })],
    errors: [...AUTH_ERRORS, "USAGE", "VALIDATION"],
  },
  {
    path: ["entries", "create"], summary: "创建已停止的时间条目", usage: "chronolog entries create --category <id|名称> --description <文本> [--tag <id|名称>...] --started-at <iso> --stopped-at <iso>",
    auth: true, operation: "write", positionals: [],
    flags: [flag("category", "string", "分类 ID 或精确名称", { value: "id|名称", required: true }), flag("description", "string", "描述", { value: "文本", required: true }), flag("tag", "repeatable-string", "标签 ID 或精确名称", { value: "id|名称" }), flag("started-at", "string", "开始 ISO 时刻", { value: "iso", required: true }), flag("stopped-at", "string", "结束 ISO 时刻", { value: "iso", required: true })],
    errors: [...WRITE_ERRORS, "OVERLAP"],
  },
  {
    path: ["entries", "update"], summary: "全量更新已停止的时间条目", usage: "chronolog entries update <id> --category <id|名称> --description <文本> [--tag <id|名称>...] --started-at <iso> --stopped-at <iso>",
    auth: true, operation: "write", positionals: [positional("id", "条目 ID")],
    flags: [flag("category", "string", "分类 ID 或精确名称", { value: "id|名称", required: true }), flag("description", "string", "描述", { value: "文本", required: true }), flag("tag", "repeatable-string", "完整替换标签", { value: "id|名称" }), flag("started-at", "string", "开始 ISO 时刻", { value: "iso", required: true }), flag("stopped-at", "string", "结束 ISO 时刻", { value: "iso", required: true })],
    errors: [...WRITE_ERRORS, "OVERLAP"],
  },
  {
    path: ["entries", "delete"], summary: "删除已停止的时间条目", usage: "chronolog entries delete <id>",
    auth: true, operation: "destructive", positionals: [positional("id", "条目 ID")], flags: [], errors: WRITE_ERRORS,
  },
  {
    path: ["stats", "today"], summary: "读取当天统计", usage: "chronolog stats today [--tz <tz>] [--tag-id <id>] [--rollup]",
    auth: true, operation: "read", positionals: [],
    flags: [flag("tz", "string", "IANA 时区", { value: "tz" }), flag("tag-id", "string", "标签 ID", { value: "id" }), flag("rollup", "boolean", "把子分类秒数并入父级")], errors: AUTH_ERRORS,
  },
  {
    path: ["stats", "range"], summary: "读取日期范围统计", usage: "chronolog stats range --from <YYYY-MM-DD> --to <YYYY-MM-DD> [--tag-id <id>] [--rollup] [--tz <tz>]",
    auth: true, operation: "read", positionals: [],
    flags: [flag("from", "string", "起始日期（闭区间）", { value: "YYYY-MM-DD", required: true }), flag("to", "string", "结束日期（闭区间）", { value: "YYYY-MM-DD", required: true }), flag("tag-id", "string", "标签 ID", { value: "id" }), flag("rollup", "boolean", "把子分类秒数并入父级"), flag("tz", "string", "IANA 时区", { value: "tz" })], errors: [...AUTH_ERRORS, "USAGE", "VALIDATION"],
  },
  {
    path: ["goals", "list"], summary: "列出目标及进度", usage: "chronolog goals list [--tz <tz>]",
    auth: true, operation: "read", positionals: [], flags: [flag("tz", "string", "IANA 时区", { value: "tz" })], errors: AUTH_ERRORS,
  },
  {
    path: ["goals", "add"], summary: "创建目标", usage: "chronolog goals add <name> [--icon <emoji>] [--category <id|名称>] [--tag <id|名称>] --direction <lt|gt> --hours <n> --period <day|week|month> [--due <YYYY-MM-DD>]",
    auth: true, operation: "write", positionals: [positional("name", "目标名")],
    flags: [flag("icon", "string", "图标", { value: "emoji" }), flag("category", "string", "分类 ID 或精确名称", { value: "id|名称" }), flag("tag", "string", "标签 ID 或精确名称", { value: "id|名称" }), flag("direction", "string", "目标方向", { value: "lt|gt", required: true }), flag("hours", "string", "目标小时数", { value: "n", required: true }), flag("period", "string", "周期", { value: "day|week|month", required: true }), flag("due", "string", "截止日期", { value: "YYYY-MM-DD" })], errors: WRITE_ERRORS,
  },
  {
    path: ["goals", "update"], summary: "更新目标", usage: "chronolog goals update <id> [字段 flags]",
    auth: true, operation: "write", positionals: [positional("id", "目标 ID")],
    flags: [flag("name", "string", "目标名", { value: "名称" }), flag("icon", "string", "图标", { value: "emoji" }), flag("category", "string", "分类 ID、名称或 none", { value: "id|名称|none" }), flag("tag", "string", "标签 ID、名称或 none", { value: "id|名称|none" }), flag("direction", "string", "目标方向", { value: "lt|gt" }), flag("hours", "string", "目标小时数", { value: "n" }), flag("period", "string", "周期", { value: "day|week|month" }), flag("due", "string", "截止日期", { value: "YYYY-MM-DD" })], errors: WRITE_ERRORS,
  },
  {
    path: ["goals", "delete"], summary: "删除目标", usage: "chronolog goals delete <id>",
    auth: true, operation: "destructive", positionals: [positional("id", "目标 ID")], flags: [], errors: WRITE_ERRORS,
  },
  ...catalogForTree("categories", "分类", true),
  ...catalogForTree("tags", "标签", false),
  {
    path: ["tokens", "list"], summary: "列出 Personal access tokens", usage: "chronolog tokens list",
    auth: true, operation: "read", positionals: [], flags: [], errors: AUTH_ERRORS,
  },
  {
    path: ["tokens", "create"], summary: "创建 Personal access token", usage: "chronolog tokens create <name>",
    auth: true, operation: "write", positionals: [positional("name", "Token 名称")], flags: [], errors: WRITE_ERRORS,
  },
  {
    path: ["tokens", "delete"], summary: "删除 Personal access token", usage: "chronolog tokens delete <id>",
    auth: true, operation: "destructive", positionals: [positional("id", "Token ID")], flags: [], errors: WRITE_ERRORS,
  },
  {
    path: ["account", "profile"], summary: "更新用户名或显示名称", usage: "chronolog account profile [--username <u>] [--display-name <n>]",
    auth: true, operation: "write", positionals: [], flags: [flag("username", "string", "新用户名", { value: "u" }), flag("display-name", "string", "新显示名称，空串表示清除", { value: "n" })], errors: WRITE_ERRORS,
  },
  {
    path: ["account", "password"], summary: "修改密码并撤销 sessions", usage: "chronolog account password --current-password <p> --new-password <p>",
    auth: true, operation: "write", positionals: [], flags: [flag("current-password", "string", "当前密码", { value: "p", required: true }), flag("new-password", "string", "新密码", { value: "p", required: true })], errors: WRITE_ERRORS,
  },
  {
    path: ["account", "delete"], summary: "永久删除账号及其数据", usage: "chronolog account delete --password <p>",
    auth: true, operation: "destructive", positionals: [], flags: [flag("password", "string", "密码确认", { value: "p", required: true })], errors: WRITE_ERRORS,
  },
  {
    path: ["account", "meta"], summary: "读取服务端注册设置", usage: "chronolog account meta",
    auth: false, operation: "read", positionals: [], flags: [], errors: ["AUTH_MISSING", "NETWORK"],
  },
  {
    path: ["health"], summary: "检查服务端连通性", usage: "chronolog health [--url <url>]",
    auth: false, operation: "read", positionals: [], flags: [flag("url", "string", "Chronolog 服务地址", { value: "url" })], errors: ["AUTH_MISSING", "NETWORK"],
  },
];

function catalogForTree(root: "categories" | "tags", noun: string, archive: boolean): CommandSpec[] {
  const specs: CommandSpec[] = [
    { path: [root, "list"], summary: `列出${noun}`, usage: `chronolog ${root} list`, auth: true, operation: "read", positionals: [], flags: [], errors: AUTH_ERRORS },
    {
      path: [root, "add"], summary: `创建${noun}`, usage: `chronolog ${root} add <name> [--color <1-8|none>] [--parent <id|none|root>]`, auth: true, operation: "write",
      positionals: [positional("name", `${noun}名`)], flags: [flag("color", "string", "颜色编号或 none", { value: "1-8|none" }), flag("parent", "string", "父级 ID 或顶层哨兵", { value: "id|none|root" })], errors: WRITE_ERRORS,
    },
    {
      path: [root, "rename"], summary: `更新${noun}`, usage: `chronolog ${root} rename <id> [--name <n>] [--color <1-8|none>] [--parent <id|none|root>]`, auth: true, operation: "write",
      positionals: [positional("id", `${noun} ID`)], flags: [flag("name", "string", `新${noun}名`, { value: "n" }), flag("color", "string", "颜色编号或 none", { value: "1-8|none" }), flag("parent", "string", "父级 ID 或顶层哨兵", { value: "id|none|root" })], errors: WRITE_ERRORS,
    },
    { path: [root, "delete"], summary: `删除${noun}`, usage: `chronolog ${root} delete <id>`, auth: true, operation: "destructive", positionals: [positional("id", `${noun} ID`)], flags: [], errors: WRITE_ERRORS },
  ];
  if (archive) {
    specs.splice(3, 0,
      { path: [root, "archive"], summary: `归档${noun}`, usage: `chronolog ${root} archive <id>`, auth: true, operation: "write", positionals: [positional("id", `${noun} ID`)], flags: [], errors: WRITE_ERRORS },
      { path: [root, "unarchive"], summary: `取消归档${noun}`, usage: `chronolog ${root} unarchive <id>`, auth: true, operation: "write", positionals: [positional("id", `${noun} ID`)], flags: [], errors: WRITE_ERRORS },
    );
  }
  return specs;
}

export function findCommand(path: readonly string[]): CommandSpec | undefined {
  return COMMANDS.find((command) =>
    command.path.length === path.length && command.path.every((part, index) => part === path[index]));
}

export function rootNames(): string[] {
  return [...new Set(COMMANDS.map((command) => command.path[0]))];
}

export function commandsUnder(root: string): CommandSpec[] {
  return COMMANDS.filter((command) => command.path[0] === root);
}
