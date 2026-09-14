# Chronolog CLI

面向 AI agent 的 [Chronolog](../Chronolog) 命令行客户端。业务命令输出**单一 JSON 对象**到 stdout，方便 agent 解析；人类可读的错误摘要输出到 stderr。

## 安装

```bash
npm i -g chronolog-cli
```

要求 Node.js 22+。

### 可选：安装 Agent Skill

CLI 和 Skill 分开安装。Skill 会指导 agent 先读取状态、显式处理时区，并在危险操作前确认；具体命令语法仍以已安装 CLI 的帮助为准。

```bash
# Codex（用户级）
gh skill install MaplumeX/Chronolog-cli chronolog --agent codex --scope user

# Claude Code（用户级）
gh skill install MaplumeX/Chronolog-cli chronolog --agent claude-code --scope user
```

Skill 源文件位于 [`skills/chronolog/SKILL.md`](skills/chronolog/SKILL.md)，通过 GitHub 分发，不包含在 npm 包中。

## 本地开发

```bash
npm install
npm run build
npm link   # 可选：全局注册 chronolog 命令
```

## 认证配置

两种方式（环境变量优先）：

1. **环境变量**（推荐，token 不落盘）：

   ```bash
   export CHRONOLOG_URL=http://127.0.0.1:8080
   export CHRONOLOG_TOKEN=<personal access token>
   ```

2. **配置文件** `~/.config/chronolog-cli/config.json`（遵循 `XDG_CONFIG_HOME`）：

   ```bash
   chronolog auth login --url http://127.0.0.1:8080 --token <token>
   ```

token 明文存于配置文件（与 gh cli 的 hosts.yml 同级风险），定位为个人自托管场景。

未配置认证时，任何命令输出 `{"error":{"code":"AUTH_MISSING",...}}` 并以退出码 1 结束，message 中包含配置方法提示。

## 输出约定

- 业务成功：stdout 输出单一 JSON 对象（可被 `JSON.parse`），退出码 0
- 失败：stdout 输出 `{"error":{"code":"...","message":"..."}}`，stderr 一行纯文本摘要，退出码 1
- `--help` / `help` / `--version` / `version`：stdout 输出简洁纯文本，退出码 0
- `help --json` / `version --json` / `capabilities`：stdout 输出单一 JSON 对象，退出码 0
- 错误码：服务端错误透传（`UNAUTHORIZED` / `NOT_FOUND` / `CONFLICT` / `OVERLAP` / `VALIDATION` / `PARSE` 等）；CLI 自身错误用 `AUTH_MISSING` / `NETWORK` / `USAGE` / `INTERNAL`

## 能力发现

```bash
chronolog --help                         # 根帮助（纯文本）
chronolog timer --help                   # 命令组帮助
chronolog timer start --help             # 子命令帮助
chronolog help timer start --json        # 同一份元数据，JSON 格式
chronolog --version                      # 简洁版本文本
chronolog version --json                 # {"name":"chronolog","version":"..."}
chronolog capabilities                   # 全部命令、参数、认证与操作类型
```

帮助与能力清单不需要认证，也不会发起网络请求。`capabilities` 适合 agent 初次接触或 CLI 升级后重新发现接口；日常调用可使用更小的 scoped help。

## 时区

`entries list`、`stats today`、`stats range`、`goals list` 需要 IANA 时区。默认取本机时区（`Intl.DateTimeFormat().resolvedOptions().timeZone`），可用 `--tz Asia/Shanghai` 覆盖。agent 在远程运行时建议显式传 `--tz`。

服务端另有用户级时区设置（`account profile --timezone <tz>`），但它只影响 Web 端展示；上述日期范围接口仍要求显式 `tz` 参数，不会回退到用户设置。

## 命令一览

### 认证与账号

```bash
chronolog auth login --url <url> --token <token>   # 写配置文件
chronolog auth status                              # url、token 掩码、认证来源（env/file）、当前用户
chronolog auth logout                              # 删除配置文件中的认证信息
chronolog auth register --url <url> --username <u> --password <p>  # 注册（可选功能）
chronolog account profile [--username <u>] [--display-name <n>] [--timezone <tz|none>] [--continuous-timing <true|false>]  # 改用户名/昵称/时区/无间隙计时（至少一个字段）
chronolog account password --current-password <p> --new-password <p>  # 改密码（撤销所有 session，PAT 不受影响）
chronolog account delete --password <p>           # 删账号（密码确认，级联删除全部数据，不可逆）
chronolog account meta                             # 查询注册开关（无认证）
chronolog health [--url <url>]                    # 健康检查（无认证，探测连通性）
```

`account profile --display-name ""` 空串表示清除昵称（服务端转为 null）。`--timezone` 为 IANA 时区名，`--timezone none` 清除（跟随浏览器）；`--continuous-timing true` 开启无间隙计时（停止计时器时自动开始下一段）。密码只进请求体，不会出现在任何输出中。`account meta` / `health` 不需要 token，URL 取 `--url` 或 env/config 中的 url。`auth status` 返回的 `user` 含 `timezone` 与 `continuousTiming`。

### 计时器

```bash
chronolog timer start --category <id|名称> [--description <文本>] [--tag <id|名称>...]
chronolog timer status    # 无运行中计时则 {"entry": null}
chronolog timer stop      # 开启无间隙计时时自动开始下一段（返回的 entry 为新段，stoppedAt 为 null）
chronolog timer edit [--description <文本>] [--category <id|名称>] [--tag <id|名称>...]
```

`timer edit` 编辑当前运行中的计时器，只传需要改的字段（至少一个）；`--tag` 一旦出现即全量替换该条目的标签。无运行中计时器时服务端报 `CONFLICT`。开启无间隙计时（`account profile --continuous-timing true`）后，`timer stop` 会停止旧段并在同一时刻自动开始新段（分类为空、描述为空），返回的 `entry.stoppedAt === null` 表示已换段而非完全停止。

**完全停止计时**（无间隙模式开启时）：

```bash
chronolog account profile --continuous-timing false
chronolog timer stop
```

先关开关再停止，否则 stop 只会换段。切换后想恢复无间隙模式，再执行 `account profile --continuous-timing true`。无间隙模式产生的段没有分类和描述，属正常现象，可用 `timer edit` 补齐或用 `entries merge` 合并相邻段。

**切换任务**：计时中想改做另一件事时直接 `timer start --category <新分类> ...`，服务端会自动停止旧段并在同一时刻开始新段——无需先 `timer stop`，也不会产生空段。

`--category` / `--tag` 支持名称解析：先精确匹配名称，唯一命中则使用其 id，否则视为 id 直接使用。名称不存在时服务端报 `NOT_FOUND`。

### 条目

```bash
chronolog entries list --today [--date <YYYY-MM-DD>] [--tag-id <id>] [--tz <tz>]
chronolog entries list --week  [--date <YYYY-MM-DD>] [--tz <tz>]
chronolog entries create --category <id|名称> --description <文本> [--tag <id|名称>...] --started-at <iso> --stopped-at <iso>
chronolog entries update <id> --category <id|名称> --description <文本> [--tag <id|名称>...] --started-at <iso> --stopped-at <iso>
chronolog entries delete <id>
chronolog entries merge <id> --direction <prev|next> --keep <self|other>
```

`entries create` 手动创建已停止条目（`--started-at`/`--stopped-at` 为 ISO 时刻，与 update 一致）；与既有条目重叠时服务端报 `OVERLAP`。`entries delete` 仅能删除已停止条目，运行中的报 `CONFLICT`。`entries update` 为全量字段（对应服务端 PATCH 语义）。

`entries merge` 把 `<id>` 条目与其紧邻的上一条（`--direction prev`）或下一条（`--direction next`）合并：时间取两段并集，`--keep self` 保留 `<id>` 的描述/分类/标签，`--keep other` 保留相邻条的；未被保留的那条会被删除。不相邻或对方仍在运行时报 `CONFLICT`。

### 统计

```bash
chronolog stats today [--tz <tz>] [--tag-id <id>] [--rollup]
chronolog stats range --from <YYYY-MM-DD> --to <YYYY-MM-DD> [--tag-id <id>] [--rollup] [--tz <tz>]
```

`--rollup` 把子分类秒数并入父级桶。`stats range` 按本地日期闭区间统计（`--from`/`--to` 必填，区间最多 92 天）。

### 目标

```bash
chronolog goals list [--tz <tz>]
chronolog goals add <name> [--icon <emoji>] [--category <id|名称>] [--tag <id|名称>] --direction <lt|gt> --hours <n> --period <day|week|month> [--due <YYYY-MM-DD>]
chronolog goals update <id> [--name <n>] [--icon <emoji>] [--category <id|名称>|none] [--tag <id|名称>|none] [--direction <lt|gt>] [--hours <n>] [--period <day|week|month>] [--due <YYYY-MM-DD>]
chronolog goals delete <id>
```

`--direction lt` 表示“少于 X 小时”、`gt` 表示“多于 X 小时”。`goals update` 只传需要改的字段（至少一个）；`--category none` / `--tag none` 清除关联。`goals list` 返回每个目标的进度（`progress.currentSeconds` / `progress.targetSeconds`）与状态（`active` / `achieved` / `expired`）。

### 分类

```bash
chronolog categories list
chronolog categories add <name> [--color <1-8|none>] [--parent <id|none|root>]
chronolog categories rename <id> [--name <n>] [--color <1-8|none>] [--parent <id|none|root>]
chronolog categories archive <id>
chronolog categories unarchive <id>
chronolog categories delete <id>
```

`--color` 取 1–8 的调色板编号；`--color none`（或 `null`）清除颜色。`--parent` 指定父分类 id，`--parent none` / `--parent root` 提升为顶层。`rename` 只传需要改的字段（至少一个）。删除分类时服务端会把引用它的条目置 NULL 并级联删除其子分类（不再报 409）。

### 标签

```bash
chronolog tags list
chronolog tags add <name> [--color <1-8|none>] [--parent <id|none|root>]
chronolog tags rename <id> [--name <n>] [--color <1-8|none>] [--parent <id|none|root>]
chronolog tags delete <id>
```

`--color` / `--parent` 语义同分类。删除被目标（goal）引用的标签时服务端报 `409 CONFLICT`（“该标签已被目标引用”）。

### Token 管理

```bash
chronolog tokens list
chronolog tokens create <name>   # 明文 token 仅此一次输出，注意保存
chronolog tokens delete <id>
```

## 参数语法

- `--flag value` 与 `--flag=value` 均可
- 裸 `--flag` 为布尔 true（如 `--today`、`--week`）
- 重复 flag 聚合为数组（如多个 `--tag`）
- 未知 flag、缺少 flag 值、重复的非数组 flag、多余位置参数都会返回 `USAGE`

## 开发

```bash
npm run typecheck   # tsc --noEmit
npm test            # tsc + node --test（编译产物）
npm run build       # 编译到 dist/
node dist/index.js auth status   # 冒烟
```

测试不依赖真实服务端：`test/client.test.ts` 用 `node:http` 起本地假服务器验证错误归一化。
