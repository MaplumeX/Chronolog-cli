# Chronolog CLI

面向 AI agent 的 [Chronolog](../Chronolog) 命令行客户端。所有命令输出**单一 JSON 对象**到 stdout，方便 agent 解析；人类可读的摘要输出到 stderr。

## 安装

```bash
npm install
npm run build
npm link   # 可选：全局注册 chronolog 命令
```

要求 Node.js 22+。

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

- 成功：stdout 输出单一 JSON 对象（可被 `JSON.parse`），退出码 0
- 失败：stdout 输出 `{"error":{"code":"...","message":"..."}}`，stderr 一行纯文本摘要，退出码 1
- 错误码：服务端错误透传（`UNAUTHORIZED` / `NOT_FOUND` / `CONFLICT` / `OVERLAP` / `VALIDATION` / `PARSE` 等）；CLI 自身错误用 `AUTH_MISSING` / `NETWORK` / `USAGE` / `INTERNAL`

## 时区

`entries list`、`stats today` 需要 IANA 时区。默认取本机时区（`Intl.DateTimeFormat().resolvedOptions().timeZone`），可用 `--tz Asia/Shanghai` 覆盖。agent 在远程运行时建议显式传 `--tz`。

## 命令一览

### 认证与账号

```bash
chronolog auth login --url <url> --token <token>   # 写配置文件
chronolog auth status                              # url、token 掩码、认证来源（env/file）、当前用户
chronolog auth logout                              # 删除配置文件中的认证信息
chronolog auth register --url <url> --username <u> --password <p>  # 注册（可选功能）
```

### 计时器

```bash
chronolog timer start --category <id|名称> [--description <文本>] [--tag <id|名称>...]
chronolog timer status    # 无运行中计时则 {"entry": null}
chronolog timer stop
```

`--category` / `--tag` 支持名称解析：先精确匹配名称，唯一命中则使用其 id，否则视为 id 直接使用。名称不存在时服务端报 `NOT_FOUND`。

### 条目

```bash
chronolog entries list --today [--date <YYYY-MM-DD>] [--tag-id <id>] [--tz <tz>]
chronolog entries list --week  [--date <YYYY-MM-DD>] [--tz <tz>]
chronolog entries update <id> --category <id|名称> --description <文本> [--tag <id|名称>...] --started-at <iso> --stopped-at <iso>
```

> **注意**：没有 `entries create` / `entries delete` 命令。Chronolog 服务端只提供 `PATCH /api/entries/:id`，没有手动创建和删除条目的端点；条目由 `timer start` / `timer stop` 产生。`entries update` 为全量字段（对应服务端 PATCH 语义）。

### 统计

```bash
chronolog stats today [--tz <tz>] [--tag-id <id>]
```

### 分类

```bash
chronolog categories list
chronolog categories add <name>
chronolog categories rename <id> <new-name>
chronolog categories delete <id>   # 有时间记录引用时服务端报 409 CONFLICT
```

### 标签

```bash
chronolog tags list
chronolog tags add <name>
chronolog tags rename <id> <new-name>
chronolog tags delete <id>
```

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

## 开发

```bash
npm run typecheck   # tsc --noEmit
npm test            # tsc + node --test（编译产物）
npm run build       # 编译到 dist/
node dist/index.js auth status   # 冒烟
```

测试不依赖真实服务端：`test/client.test.ts` 用 `node:http` 起本地假服务器验证错误归一化。