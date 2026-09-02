# Sync CLI with Chronolog server updates

## Goal

让 Chronolog-cli（Agent CLI）与原项目 Chronolog 服务端（`../Chronolog`，main@4a59635）自 8/27 以来的新增 API 保持同步：补齐缺失的命令、更新受数据结构变化影响的既有命令，并同步 README 文档。范围决策：**全部纳入**（用户已确认），仅排除 `GET /api/entries/boundary`。

## Background（服务端契约，已核实到源码）

CLI 建立于 8/27（commit a70878d），服务端此后新增/变更如下：

### 新增端点（CLI 未覆盖）

1. **条目**（`server/src/routes/entries.ts`）
   - `POST /api/entries` — 手动创建条目。body 全量：`description, categoryId, tagIds, startedAt, stoppedAt`（ISO 时刻）；返回 `{ entry }` + 201；重叠 409 OVERLAP、stoppedAt ≤ startedAt 400 VALIDATION、分类不存在 404。
   - `DELETE /api/entries/:id` — 删除已停止条目；运行中 409；返回 `{ ok: true }`。
2. **计时器**（`server/src/routes/timer.ts`）
   - `PATCH /api/timer/current` — 编辑运行中条目的 `description / categoryId / tagIds`（部分字段，strictObject）；无运行中 409；返回 `{ entry }`。
3. **统计**（`server/src/routes/today.ts` → `statsRange`）
   - `GET /api/stats/range` — query：`tz, from, to`（tz 本地日期闭区间，最多 92 天）+ 可选 `tagId, rollup`。返回 `{ tz, rangeStart, rangeEnd, days[], categories[], tags[], totalSeconds }`（无 trend 字段，已核实 `RangeStats` 类型）。
4. **目标 goals**（`server/src/routes/goals.ts`，全新模块）
   - `GET /api/goals?tz=` — `{ goals: GoalWithProgress[] }`，含 `progress: { currentSeconds: number | null; targetSeconds: number }`、`status: "active" | "achieved" | "expired"`。
   - `POST /api/goals` — body：`name(≤32), icon(默认"🎯", ≤8), categoryId?, tagId?, direction: "lt"|"gt", hours(>0, ≤1000), periodUnit: "day"|"week"|"month", dueDate?(YYYY-MM-DD)`；返回 `{ id }`。
   - `PATCH /api/goals/:id` — 部分字段（至少一个）；返回更新后全字段对象。
   - `DELETE /api/goals/:id` — 返回 `{ ok: true }`。
5. **账号 account**（`server/src/routes/account.ts`，全新模块）
   - `PATCH /api/profile` — `username?` / `displayName?`（空串→null）；返回 `{ id, username, displayName }`。
   - `PATCH /api/account/password` — `currentPassword, newPassword`；撤销所有 session（PAT 不受影响）；返回 `{ ok: true }`。
   - `DELETE /api/account` — body `password` 确认，FK 级联删除全部数据；返回 `{ ok: true }`。
   - `GET /api/meta` — `{ registrationOpen: boolean }`（无认证）。
6. **分类归档**（`server/src/routes/categories.ts` #34）
   - `POST /api/categories/:id/archive` / `POST /api/categories/:id/unarchive`；返回更新后的分类对象。

### 结构变更（影响 CLI 既有命令）

7. **分类/标签列表输出**（#24、#26）：categories 每项新增 `color`（1–8 | null）、`parentId`、`archivedAt`；tags 每项新增 `color`、`parentId`。`src/api.ts` 的 `listCategories/listTags` 返回类型需拓宽。
8. **分类/标签 add** 支持 `color` 和 `parentId`；`rename`（PATCH）可同时改 `name/color/parentId`（部分字段，至少一个）。
9. **分类删除放宽**（#34）：引用置 NULL、子分类一并删除，不再 409。README "有时间记录引用时服务端报 409" 说明过时。
10. **标签删除**：被 goal 引用时 409 CONFLICT "该标签已被目标引用"。
11. **`stats/today` 新增 `rollup` query 参数**（子分类秒数并入父级桶）。
12. **`GET /api/health`** — 无认证健康检查。

### README 过时

13. "没有 `entries create` / `entries delete` 命令" 的说明需替换为新命令文档；命令一览需补 goals/account/归档/颜色/层级/stats range。

## Requirements

所有新命令遵循既有 CLI 约定（见 `.trellis/spec/backend/cli-guidelines.md`）：单一 JSON 输出、`noUnknownFlags`、错误码透传、`--flag value` / `--flag=value` / 裸布尔语法。

### R1 条目命令补齐

- `entries create <无位置参数> --category <id|名称> --description <文本> [--tag <id|名称>...] --started-at <iso> --stopped-at <iso>` → `POST /api/entries`。时间直接要求 ISO 时刻（与 update 一致，不做本地日期转换）。
- `entries delete <id>` → `DELETE /api/entries/:id`。

### R2 计时器编辑

- `timer edit [--description <文本>] [--category <id|名称>] [--tag <id|名称>...]` → `PATCH /api/timer/current`（部分字段，仅传入的进 body；tag 与 update 一致：传了 `--tag` 就全量替换 tagIds）。至少传一个字段。

### R3 区间统计

- `stats range --from <YYYY-MM-DD> --to <YYYY-MM-DD> [--tag-id <id>] [--rollup] [--tz <tz>]` → `GET /api/stats/range`。`--from`/`--to` 必填。
- `stats today` 增加 `[--rollup]`。

### R4 goals 模块（新命令组）

- `goals list [--tz <tz>]`
- `goals add <name> [--icon <emoji>] [--category <id|名称>] [--tag <id|名称>] --direction <lt|gt> --hours <n> --period <day|week|month> [--due <YYYY-MM-DD>]`
- `goals update <id> [--name] [--icon] [--category] [--tag] [--direction] [--hours] [--period] [--due]`（部分字段，至少一个）
- `goals delete <id>`
- `--category`/`--tag` 复用 resolve 名称解析。

### R5 分类/标签增强

- `categories add <name> [--color <1-8>] [--parent <id>]`；`categories rename <id> [--name <n>] [--color <1-8>] [--parent <id>|--parent root]`（部分字段，至少一个）
- `categories archive <id>` / `categories unarchive <id>`
- `tags add <name> [--color <1-8>] [--parent <id>]`；`tags rename <id> [--name] [--color] [--parent]`
- `--color` 用 `--color none`（或 `--color null`）表示清除颜色。`--parent none`/`--parent root` 提升为顶层。

### R6 account 模块（新命令组）

- `account profile [--username <u>] [--display-name <n>]`（部分字段，至少一个；`--display-name ""` → null）
- `account password --current-password <p> --new-password <p>`
- `account delete --password <p>`（危险操作，body 确认，服务端兜底）
- `account meta` → `GET /api/meta`（无认证，不走 `api()`，直接 `request(url, "", ...)`，与 `auth register` 同模式）

### R7 健康检查

- `chronolog health`（顶层命令）→ `GET /api/health`，无认证。用于 agent 快速探测连通性。

### R8 数据类型更新

- `src/api.ts`：`listCategories` 返回类型补 `color/parentId/archivedAt`；`listTags` 补 `color/parentId`。

### R9 文档同步

- README 命令一览补齐上述全部命令；删除 "没有 entries create/delete" 说明；更新分类删除语义、标签删除约束、stats today `--rollup`。

## Acceptance Criteria

- [ ] `npm run typecheck` 与 `npm test` 通过（含新增命令测试）。
- [ ] R1–R8 每组命令：成功路径输出单一 JSON、退出码 0；参数缺失/未知 flag 输出 USAGE 错误 JSON、退出码 1。
- [ ] `entries create`/`timer edit`/`goals add`/`goals update`/`categories|tags add|rename` 的名称解析（`--category`/`--tag`）复用 resolve.ts 语义。
- [ ] 服务端错误（404/409/400）经 client.ts 归一化为 `{"error":{code,message}}`，退出码 1（既有机制，验证不被破坏）。
- [ ] README 与实际命令一致（含命令数量、flag 说明）。
- [ ] 无 SECRET 泄漏：`account password`/`account delete` 的密码只进请求 body，不出现在任何输出中。

## Out of Scope

- `GET /api/entries/boundary`（前端 gap 插槽用途，对 agent 无增量价值；用户已确认排除）
- 前端 web 功能
- `auth login/register` 等既有命令的行为变更

## Key Decisions

- D1 范围：全部纳入（用户确认 2026-09-02）。
- D2 `entries create` 时间语义：直接要求 ISO 时刻，与 `entries update` 一致，不做本地日期+时间便捷转换。
- D3 account 高危操作（改密码/删账号）暴露给 CLI：agent 场景需要完整能力，服务端密码确认兜底，错误码透传。
- D4 `timer edit` 子命令名（而非 `timer update`）：编辑的是"当前运行中的计时器"，edit 更贴合 #23 语义。
