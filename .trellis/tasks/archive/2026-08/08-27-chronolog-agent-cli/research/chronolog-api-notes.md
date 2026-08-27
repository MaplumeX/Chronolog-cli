# Chronolog 服务端 API 调研笔记

> 调研对象：`/home/maplume/projects/Chronolog`（Fastify + Drizzle + SQLite，Node 22+）

## 认证

- **Session cookie**（浏览器用）与 **Personal Access Token**（非浏览器客户端）双轨
- PAT：`Authorization: Bearer <token>`，服务端 `auth.ts` 中 `hashToken = sha256(token)` 存库
- Token 管理端点：
  - `GET /api/tokens` → `{tokens: [{id, name, createdAt, lastUsedAt}]}`
  - `POST /api/tokens` body `{name}`（1-64 字符）→ 返回 `{id, name, token, createdAt}`，**明文 token 仅此一次**
  - `DELETE /api/tokens/:id`
- 账号：`POST /api/auth/register`（username 3-32 字母/数字/下划线，password ≥8）、`POST /api/auth/login`、`POST /api/auth/logout`、`GET /api/auth/me`

## 端点清单

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | /api/timer/current | `{entry: EntryDto \| null}` |
| POST | /api/timer/start | body `{categoryId, description?, tagIds?}`；已运行会自动停旧开新 |
| POST | /api/timer/stop | 停止当前运行中计时，无则 409 CONFLICT |
| GET | /api/entries/today?tz=&date= | date 可选，需合法 tz |
| GET | /api/entries/week?tz=&date= | |
| GET | /api/stats/today?tz=&tagId= | tz 通过 query 传，非法/缺失报 400 |
| GET | /api/categories | `{categories:[{id,name,entryCount}]}` |
| POST | /api/categories | body `{name}`(≤32)，重名 409 |
| PATCH | /api/categories/:id | body `{name}` |
| DELETE | /api/categories/:id | 有记录引用时 409 |
| GET | /api/tags | 同 categories 结构 |
| POST | /api/tags | name ≤ 上限，重名 409 |
| PATCH | /api/tags/:id | |
| DELETE | /api/tags/:id | |
| PATCH | /api/entries/:id | body `{description, categoryId, tagIds[], startedAt, stoppedAt}` 全量；运行中条目 409；时间重叠 409 OVERLAP |

**没有** `POST /api/entries`（手动创建）和 `DELETE /api/entries/:id` —— CLI 不提供对应命令。

## 错误格式

Fastify AppError：HTTP 状态码 + body `{error: {code, message}}`（中文 message）。
错误码：`UNAUTHORIZED`(401)、`NOT_FOUND`(404)、`CONFLICT`(409)、`OVERLAP`(409)、`VALIDATION`(400)、`PARSE` 等。CLI 透传这些 code。

## 时区

- `today`/`week`/`stats` 均要求 IANA tz（`requireTz`，luxon IANAZone 校验），query 参数名 `tz`
- date 参数格式 `YYYY-MM-DD`，按 tz 本地日期解释

## 其他要点

- timer start：`description` trim 后存储，`tagIds` 去重；重复启动有 unique violation 重试逻辑
- entries PATCH 校验：分类/标签必须属于当前用户；`stoppedAt > startedAt`；半开区间重叠检测（边界相接允许）
- 新用户预置分类：工作、学习、休息、事务
- 本地开发：API http://127.0.0.1:8080，`npm run dev`（在 Chronolog 目录）