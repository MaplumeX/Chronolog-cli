# Design: Chronolog Agent CLI

## 技术选型

- **运行时**: Node.js 22+（与服务端一致，原生 fetch、原生 TS 类型支持好）
- **语言**: TypeScript 5.x, ESM（`"type": "module"`，与服务端一致）
- **CLI 框架**: 不引入 commander/yargs 等重依赖，自写轻量参数解析（命令树简单、参数少、面向 agent，减少供应链面）。若实现中发现解析复杂度超预期，允许引入 `commander`（需在 implement 阶段说明理由）
- **HTTP**: 原生 `fetch`
- **测试**: `node:test`（服务端测试即用 node:test，保持一致，见 `../Chronolog/server/test/`）
- **构建/检查**: `tsc` 直接编译到 `dist/`，bin 指向 `dist/index.js`；`npm run typecheck` 用 `tsc --noEmit`

## 架构

```
Chronolog-cli/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts        # 入口：解析 argv → 分发命令 → 输出 JSON / 错误处理
│   ├── config.ts       # 认证配置：env 优先，~/.config/chronolog-cli/config.json 兜底；login/logout/status
│   ├── client.ts       # API 客户端：fetch 封装、Bearer 注入、错误归一化为 {code,message}
│   ├── commands/       # 每个域一个文件，导出 (args) => Promise<unknown>
│   │   ├── auth.ts
│   │   ├── timer.ts
│   │   ├── entries.ts
│   │   ├── stats.ts
│   │   ├── categories.ts
│   │   ├── tags.ts
│   │   └── tokens.ts
│   └── resolve.ts      # id/名称解析：category、tag 名称 → id
└── test/
    ├── args.test.ts    # 参数解析单测
    ├── config.test.ts  # 配置读取优先级单测（XDG_CONFIG_HOME 指向临时目录）
    └── client.test.ts  # 用 node:http 起本地假服务器测 client 错误归一化
```

### 数据流

1. `index.ts` 解析 argv：第一个非 flag 段为命令路径（如 `timer start`），其余为 flags/位置参数
2. `config.ts` 解析认证：`CHRONOLOG_URL`/`CHRONOLOG_TOKEN` env → 配置文件 → 报 `AUTH_MISSING` 错误
3. `client.ts` 发请求：`fetch(url + path, { headers: { Authorization: Bearer ... } })`；非 2xx 时解析服务端错误体 `{error:{code,message}}`（Fastify AppError 格式，见 `../Chronolog/server/src/errors.ts`），归一化后抛出
4. 命令函数返回普通对象，`index.ts` 统一 `JSON.stringify(obj)` 到 stdout，`process.exitCode = 0`
5. 任何错误：`JSON.stringify({ error: { code, message } })` 到 stdout（保持 agent 解析一致性，stderr 只放一行人类可读摘要），`process.exitCode = 1`

### 关键契约

**错误码**：透传服务端 AppError 的 code（`UNAUTHORIZED`/`NOT_FOUND`/`CONFLICT`/`OVERLAP`/`VALIDATION` 等）；CLI 自身错误用 `AUTH_MISSING`/`AUTH_INVALID`/`NETWORK`/`USAGE`（参数错误）/`PARSE`（响应不是合法 JSON，如 URL 指向非 Chronolog 服务）。

**tz 策略**：`entries list`、`stats today` 需要 tz。CLI 默认取 `Intl.DateTimeFormat().resolvedOptions().timeZone`（本机时区），`--tz` 可覆盖。agent 在远程跑时显式传 `--tz`。

**名称解析**（`resolve.ts`）：`--category`/`--tag` 值先尝试精确匹配名称（`GET /api/categories` / `GET /api/tags`），命中且唯一 → 用其 id；否则视为已是 id 直接使用；`entries update`/`timer start` 共用。名称命中 0 个且不像 id → 报 `NOT_FOUND`。

## 权衡

- **自写参数解析 vs commander**：命令树仅 2 层、约 20 个命令，flag 类型少（string/string[]/boolean）。自写 ~80 行可覆盖，避免依赖。风险：边界 case（`--flag=value` 语法）——决定支持 `--flag value` 与 `--flag=value` 两种写法，单测覆盖。
- **错误 JSON 输出到 stdout 而非 stderr**：agent 通常只看 stdout 或只看退出码；统一 stdout 保证可解析。stderr 同步输出一行纯文本摘要供人类。
- **不做手动创建条目 / 删除条目命令**：服务端只有 `PATCH /api/entries/:id`，没有 POST/DELETE（已核实 routes/entries.ts）。条目由 timer start/stop 产生。README 中说明。

## 兼容与回滚

- 纯新增项目，不影响 Chronolog 主仓库
- 配置文件路径固定 `~/.config/chronolog-cli/config.json`，无迁移问题