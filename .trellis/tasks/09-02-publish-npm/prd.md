# PRD: Publish chronolog-cli to npm registry

## Background

`chronolog-cli` 是一个供 AI agent 操作 Chronolog 实例的 JSON-output CLI，已完成开发（版本 0.1.0），需要发布到 npm 公共 Registry，让用户可通过 `npm i -g chronolog-cli` 安装使用。

## 现状

- npm 已登录（用户名 `maplume`）
- 包名 `chronolog-cli` 在 npmjs.org 上未被占用（404 确认）
- `package.json` 当前 `private: true`，无 `files` / `license` / `repository` 字段
- 构建产物 `dist/` 由 `tsc` 生成，bin 入口为 `dist/index.js`

## Requirements

1. 调整 `package.json` 发布元数据：
   - 移除 `"private": true`
   - 添加 `files: ["dist"]`，只发布构建产物
   - 添加 `license`、`repository`、`keywords`、`author` 等标准字段
2. 构建与测试全部通过后才能发布（`npm run build` + `npm test`）
3. 执行 `npm publish --dry-run` 确认发布内容（无多余文件、bin 入口正确）
4. 正式执行 `npm publish`
5. 发布后验证：`npm view chronolog-cli` 可查到，且全局安装后 CLI 可执行

## Acceptance Criteria

- [ ] `package.json` 不含 `private: true`，包含 `files`/`license` 等元数据
- [ ] `npm run build` 与 `npm test` 通过
- [ ] `npm publish --dry-run` 的文件列表只含 `dist/` 产物与必要元文件
- [ ] `npm publish` 成功，`npm view chronolog-cli version` 返回 `0.1.0`
- [ ] 全局安装后 `chronolog --help`（或等价命令）可正常执行

## Non-goals

- 不改动 CLI 功能代码本身
- 不做 CI 自动发布流水线（可后续任务）
