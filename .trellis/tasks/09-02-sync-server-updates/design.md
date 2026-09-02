# Design — Sync CLI with Chronolog server updates

## 架构与边界

不引入新依赖、不改分层。沿用既有结构：

```
src/index.ts        # dispatch 路由表（root switch）——新增 goals / account / health
src/client.ts       # HTTP 归一化（不动）
src/api.ts          # 已认证封装 + listCategories/listTags 类型（R8 拓宽）
src/resolve.ts      # 名称→id 解析（复用，不改逻辑）
src/args.ts         # 参数解析（不动）
src/commands/*.ts   # 每个命令组一个文件
```

新增 `src/commands/goals.ts`、`src/commands/account.ts`；其余命令组内追加子命令。

## 各命令的契约映射

| CLI 命令 | HTTP | body/query |
|---|---|---|
| `entries create` | `POST /api/entries` | `{description, categoryId, tagIds, startedAt, stoppedAt}`（全量必填） |
| `entries delete <id>` | `DELETE /api/entries/:id` | — |
| `timer edit` | `PATCH /api/timer/current` | 仅传入字段：`{description?, categoryId?, tagIds?}` |
| `stats range` | `GET /api/stats/range` | query: `tz, from, to, tagId?, rollup?` |
| `stats today --rollup` | `GET /api/stats/today` | query 追加 `rollup=true` |
| `goals list` | `GET /api/goals` | query: `tz` |
| `goals add <name>` | `POST /api/goals` | `{name, icon?, categoryId?, tagId?, direction, hours, periodUnit, dueDate?}` |
| `goals update <id>` | `PATCH /api/goals/:id` | 部分字段（至少一个） |
| `goals delete <id>` | `DELETE /api/goals/:id` | — |
| `account profile` | `PATCH /api/profile` | `{username?, displayName?}` |
| `account password` | `PATCH /api/account/password` | `{currentPassword, newPassword}` |
| `account delete` | `DELETE /api/account` | body: `{password}` |
| `account meta` | `GET /api/meta` | 无认证，`request(url, "", path)` |
| `health` | `GET /api/health` | 无认证 |
| `categories add/rename` | `POST` / `PATCH` | `{name?, color?, parentId?}` |
| `categories archive/unarchive <id>` | `POST .../:id/archive` / `unarchive` | — |
| `tags add/rename` | 同 categories | — |

## 关键设计点

### 1. 值类型转换（CLI 字符串 → API 类型）

- `--color`：`"1"–"8"` 解析为 number；`none`/`null` → `null`（清除）。非数字或越界 → USAGE。
- `--hours`：`Number()` 解析，NaN/≤0 → USAGE（服务端仍会校验 ≤1000）。
- `--direction`/`--period`：枚举白名单校验（`lt|gt`、`day|week|month`），非法 → USAGE。
- `--parent`：`none`/`root` → `null`（提升顶层）；否则原样传 id。
- `--due`/`--from`/`--to`：YYYY-MM-DD 正则粗校验 → USAGE，精确校验交服务端。

### 2. "部分字段"语义（timer edit / goals update / categories|tags rename / account profile）

统一模式：`undefined` = 不传（保持现状）。CLI 侧只要用户提供了 flag 就放进 body；未提供任何可变字段 → USAGE "至少提供一个字段"。`tagIds` 特例：`--tag` 出现即全量替换（与 `entries update` 一致），无 `--tag` 不传 `tagIds`。

### 3. 名称解析复用

`goals add/update` 的 `--category`/`--tag`、`timer edit` 的 `--category`/`--tag`、`entries create` 的同名 flag 全部走 `resolveCategory`/`resolveTag`。注意：服务端层级化后不同父级下可同名，既有"唯一命中才解析"逻辑天然安全（多命中报 NOT_FOUND 提示用 id）。

### 4. 无认证命令（health / account meta）

不调用 `api()`（它强制 resolveAuth）。`health` 需要拿 URL：优先 `--url` flag，否则从 `resolveAuth()` 取 url（token 存在与否不影响——health 不带 Authorization）。实现上 `resolveAuth()` 在无任何配置时会抛 AUTH_MISSING，所以 health 用 `--url` 覆盖或宽松读取配置文件；推荐：`readConfigFile()` + env 回退的轻量 helper（不抛错）。

### 5. dispatch 扩展

`index.ts` root switch 增加 `goals`、`account`、`health` 三个 case；USAGE 错误消息的可用命令列表同步。

### 6. 类型拓宽（R8）

`listCategories` → `{ id, name, color, parentId, archivedAt, entryCount }[]`；`listTags` → `{ id, name, color, parentId, entryCount }[]`。`resolve.ts` 只用 `id/name`，无需改动。

## 兼容性

- 所有既有命令的输出格式不变（服务端 list 响应新增字段会自然透传到 stdout JSON，这是期望行为——agent 自由读取新字段）。
- 无配置迁移、无破坏性变更。

## 测试策略

沿用 `test/client.test.ts` 的假服务器模式：

- `args.test.ts` 补新命令的解析用例（color/parent 哨兵值、枚举校验、部分字段语义）。
- `client.test.ts` 补：entries create/delete、timer edit、stats range（query 组装）、goals CRUD、account 三命令、health/meta 无认证路径、错误码透传回归。
- `config.test.ts` 不动（health 的宽松 URL 读取如改 config.ts 则补用例）。

## 风险与回滚

- 风险集中在 `index.ts` dispatch 与 USAGE 文案，均为局部改动。
- 回滚点：整个任务一个 commit（或按命令组分 commit），revert 即可，无数据迁移。
