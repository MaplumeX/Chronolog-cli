# Implement: Chronolog Agent CLI

## 执行清单（顺序）

### 阶段 1：骨架
- [ ] 1.1 初始化 `package.json`（name: chronolog-cli, type: module, bin: `{"chronolog": "dist/index.js"}`, engines: node>=22），`tsconfig.json`（ES2022, NodeNext, strict, outDir dist）
- [ ] 1.2 `src/config.ts`：认证配置解析（env 优先 → 配置文件 → AUTH_MISSING），`XDG_CONFIG_HOME` 支持，login/logout/status 逻辑
- [ ] 1.3 `src/client.ts`：fetch 封装（Bearer 注入、超时 30s、错误归一化 `{code,message}`、PARSE/NETWORK 错误）
- [ ] 1.4 `src/index.ts`：argv 解析（支持 `--flag value` 与 `--flag=value`、`--flag` 布尔、重复 flag 聚合成数组）、命令树分发、统一 JSON 输出与错误处理（stdout JSON + stderr 摘要 + 退出码）

### 阶段 2：命令实现
- [ ] 2.1 `src/resolve.ts`：category/tag 名称 → id 解析
- [ ] 2.2 `commands/auth.ts`：login / status / logout / register
- [ ] 2.3 `commands/timer.ts`：start / status / stop
- [ ] 2.4 `commands/entries.ts`：list (today/week) / update
- [ ] 2.5 `commands/stats.ts`：today（默认本机时区，--tz/--tag-id 可选）
- [ ] 2.6 `commands/categories.ts` + `commands/tags.ts`：list/add/rename/delete
- [ ] 2.7 `commands/tokens.ts`：list/create/delete
- [ ] 2.8 `README.md`：面向 agent 的用法说明（配置方式、命令一览、JSON 输出约定、退出码），注明无手动创建/删除条目命令及原因

### 阶段 3：测试与验证
- [ ] 3.1 `test/args.test.ts`：参数解析单测（含 `--flag=value`、布尔 flag、数组聚合）
- [ ] 3.2 `test/config.test.ts`：env 优先级、配置文件读写（临时 XDG_CONFIG_HOME）、AUTH_MISSING
- [ ] 3.3 `test/client.test.ts`：本地 node:http 假服务器，验证 2xx 透传、错误体归一化、网络错误
- [ ] 3.4 `npm run typecheck && npm test && npm run build` 全绿
- [ ] 3.5 端到端验证（需要用户配合启动 Chronolog，或用 docker compose）：register → login → tokens create → timer start/status/stop → entries list → stats today → categories/tags CRUD → auth status；未配置认证时错误路径验证

## 验证命令

```bash
npm run typecheck
npm test
npm run build
node dist/index.js auth status   # 手动冒烟
```

## 回滚点

- 每阶段完成后 commit；阶段 1 骨架可独立回滚
- 全部为新增文件，回滚 = 删除新增文件 + git revert

## 审查关口

- 阶段 1 完成后：检查 client 错误码与服务端 errors.ts 对齐
- 阶段 3.5 前：确认用户本地有可用的 Chronolog 实例（http://127.0.0.1:8080）用于端到端