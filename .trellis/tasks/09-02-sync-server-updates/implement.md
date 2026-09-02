# Implement — Sync CLI with Chronolog server updates

## 执行清单（有序）

### 阶段 1：基础层

- [x] 1.1 `src/api.ts`：拓宽 `listCategories`/`listTags` 返回类型（R8）。
- [x] 1.2 `src/commands/util.ts`（或新 helper）：`--color`/`--hours`/`--parent`/日期/枚举的字符串→API 值转换函数（供各命令组复用）。
- [x] 1.3 `src/config.ts`：如需宽松读取 URL（不抛 AUTH_MISSING）的 helper（health 用），实现并补 config 测试。

### 阶段 2：命令组（每组独立可验证）

- [x] 2.1 **entries**：`entries create` / `entries delete`（R1）；更新 USAGE 文案。
- [x] 2.2 **timer**：`timer edit`（R2）。
- [x] 2.3 **stats**：`stats range` + `stats today --rollup`（R3）。
- [x] 2.4 **categories/tags**：`--color`/`--parent`、`archive`/`unarchive`、rename 部分字段化（R5）。
- [x] 2.5 **goals**：新文件 `src/commands/goals.ts`，`list/add/update/delete`（R4）。
- [x] 2.6 **account**：新文件 `src/commands/account.ts`，`profile/password/delete/meta`（R6）。
- [x] 2.7 **health**：顶层命令（R7）。
- [x] 2.8 `src/index.ts`：dispatch 增加 `goals`/`account`/`health`，更新可用命令 USAGE 文案。

### 阶段 3：测试与文档

- [x] 3.1 测试：按 design.md 测试策略补 `args.test.ts` / `client.test.ts` 用例。
- [x] 3.2 README：命令一览全量更新（R9），删除过时说明。
- [x] 3.3 全量验证（见下）。

## 验证命令

```bash
npm run typecheck   # tsc --noEmit
npm test            # tsc + node --test
node dist/index.js auth status        # 冒烟（需本地配置）
node dist/index.js health             # 冒烟
node dist/index.js goals list         # 冒烟（需服务端）
```

## 风险文件与回滚点

- `src/index.ts`（dispatch 汇聚点）— 改坏会影响所有命令，验证命令必跑。
- 其余均为命令组文件，天然隔离。
- 回滚：revert 对应 commit，无数据/配置迁移。

## 审查门

- 每阶段完成后跑 `npm run typecheck && npm test`。
- 阶段 3.3 通过后进入 Phase 3（spec 更新 → commit）。

## start 前检查

- [x] prd.md / design.md / implement.md 齐备
- [ ] implement.jsonl / check.jsonl 有真实条目（非 `_example`）
- [ ] 用户已审批最终规划摘要
