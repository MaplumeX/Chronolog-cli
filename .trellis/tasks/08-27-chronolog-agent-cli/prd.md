# PRD: Chronolog Agent CLI

## 背景

Chronolog（同级目录 `../Chronolog`）是自托管的多用户时间追踪器，服务端为 Fastify + Drizzle + SQLite，已内置 Personal Access Token 认证（`Authorization: Bearer <token>`，注释明确写着 "for non-browser clients (CLI / agents)"）。

本任务在 `Chronolog-cli` 仓库开发一个 CLI 工具，供 AI agent 连接操作 Chronolog。用户已确认：

1. 技术栈与服务端一致：Node.js 22+ / TypeScript
2. 交互形态：面向 agent 的 JSON 输出模式（不做人类交互式 UI，不做彩色表格）
3. 范围：覆盖全部 API 能力（计时器、条目、统计、分类、标签、token 管理、账号）
4. 认证配置方案由研究决定（结论见下）

## 认证配置方案（研究结论）

采用 **环境变量优先 + 配置文件兜底**（GitHub CLI / Stripe CLI 同款模式）：

- `CHRONOLOG_URL` / `CHRONOLOG_TOKEN` 环境变量优先 —— agent 场景下最常用，agent 可以在调用时注入，token 不落盘
- 否则读取配置文件 `~/.config/chronolog-cli/config.json`（`XDG_CONFIG_HOME` 支持同 gh）
- `chronolog auth login --url <url> --token <token>` 子命令把配置写入配置文件（供人类或 agent 一次性设置）
- `chronolog auth status` 显示当前认证来源与目标用户
- token 在配置文件中存明文（与 gh cli 的 hosts.yml 同级风险，本工具定位为个人自托管场景，不引入 OS keychain 复杂度）
- 未配置认证时报错退出码非 0，错误 JSON 中提示配置方法

## 命令清单

所有命令输出单一 JSON 对象到 stdout（人类可读的进度/提示到 stderr）。错误输出 `{ "error": { "code", "message" } }` 并以非 0 退出码结束。

### 认证与配置
- `chronolog auth login --url <url> --token <token>` — 写配置文件
- `chronolog auth status` — 显示 url、token 掩码、认证来源（env/file）、当前用户（调用 /api/auth/me）
- `chronolog auth logout` — 删除配置文件中的认证信息

### 账号
- `chronolog auth register --url <url> --username <u> --password <p>` — 注册（可选功能，供初始化）

### 计时器
- `chronolog timer start --category <id|名称> --description <文本> [--tag <id|名称>...]` — 启动计时；`--category` 支持名称解析（先按名称查，唯一则用之）
- `chronolog timer status` — 当前运行中的计时（无则 `{"entry": null}`）
- `chronolog timer stop` — 停止当前计时

### 条目
- `chronolog entries list --today | --week [--date <YYYY-MM-DD>] [--tag-id <id>]` — 查询条目
- `chronolog entries update <id> --category <id|名称> --description <文本> --tag <id|名称>... --started-at <iso> --stopped-at <iso>` — 编辑已停止条目（全量字段，对应 PATCH）
- `chronolog entries delete <id>` — 若服务端无此端点则不做（待实现阶段核实，见开放问题）

### 统计
- `chronolog stats today [--tz <tz>] [--tag-id <id>]`

### 分类
- `chronolog categories list`
- `chronolog categories add <name>`
- `chronolog categories rename <id> <new-name>`
- `chronolog categories delete <id>`

### 标签
- `chronolog tags list`
- `chronolog tags add <name>`
- `chronolog tags rename <id> <new-name>`
- `chronolog tags delete <id>`

### Token 管理
- `chronolog tokens list`
- `chronolog tokens create <name>` — 输出明文 token（仅此一次）
- `chronolog tokens delete <id>`

## 非目标

- 不做人类友好的表格/彩色输出（保持纯 JSON）
- 不做交互式登录流程（无浏览器 OAuth）
- 不做 OS keychain 存储
- 不做批量导入导出

## 验收标准

1. `npm install && npm run build` 在干净环境成功；`npm run typecheck`、`npm test` 通过
2. 对运行中的 Chronolog 实例端到端验证：register → login（写配置）→ tokens create → timer start/status/stop → entries list → stats today → categories/tags CRUD → auth status
3. 未配置认证时，任意命令输出错误 JSON 且退出码非 0
4. `CHRONOLOG_URL`/`CHRONOLOG_TOKEN` 环境变量存在时优先于配置文件
5. 所有命令 stdout 为可被 `JSON.parse` 的单一 JSON 对象
6. 分类/标签名称解析：timer start 可用名称代替 id，名称不存在时给出明确错误

## 开放问题（实现阶段核实）

- 服务端似乎没有 `POST /api/entries`（手动创建条目）与 `DELETE /api/entries/:id` 端点；CLI 不做超出 API 能力的功能，如确认缺失则对应命令从清单移除，并在 README 注明
- 服务端 `requireTz` 要求 IANA 时区参数；CLI 需决定默认 tz 策略（倾向：默认不传由服务端报错时提示用户传 `--tz`，或用本机时区 `Intl.DateTimeFormat().resolvedOptions().timeZone` 自动填充）