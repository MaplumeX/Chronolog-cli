import { test } from "node:test";
import assert from "node:assert/strict";
import { parseArgs, getFlag, getFlagArray, getFlagBoolean, requirePositional } from "../src/args.js";
import { CliError } from "../src/config.js";

test("命令路径 + 位置参数", () => {
  const args = parseArgs(["timer", "start", "--category", "1"]);
  assert.deepEqual(args.command, ["timer", "start"]);
  assert.equal(getFlag(args, "category"), "1");
  assert.deepEqual(args.positional, []);
});

test("--flag value 形式", () => {
  const args = parseArgs(["categories", "rename", "abc123", "新名字"]);
  assert.deepEqual(args.positional, ["abc123", "新名字"]);
});

test("--flag=value 形式", () => {
  const args = parseArgs(["entries", "list", "--date=2025-08-27", "--today"]);
  assert.equal(getFlag(args, "date"), "2025-08-27");
  assert.equal(getFlagBoolean(args, "today"), true);
});

test("裸 --flag 为布尔 true", () => {
  const args = parseArgs(["entries", "list", "--today"]);
  assert.equal(args.flags["today"], true);
  assert.equal(getFlagBoolean(args, "today"), true);
  assert.equal(getFlag(args, "today"), undefined);
});

test("重复 flag 聚合成数组", () => {
  const args = parseArgs(["timer", "start", "--category", "c1", "--tag", "t1", "--tag", "t2"]);
  assert.deepEqual(getFlagArray(args, "tag"), ["t1", "t2"]);
});

test("重复 --flag=value 聚合成数组", () => {
  const args = parseArgs(["timer", "start", "--category", "c1", "--tag=a", "--tag=b"]);
  assert.deepEqual(getFlagArray(args, "tag"), ["a", "b"]);
});

test("值本身以 -- 开头时视为下一个 flag（裸 flag 保持布尔）", () => {
  const args = parseArgs(["cmd", "sub", "--a", "--b", "x"]);
  assert.equal(args.flags["a"], true);
  assert.equal(getFlag(args, "b"), "x");
});

test("末尾裸 --flag 保持布尔", () => {
  const args = parseArgs(["entries", "list", "--week", "--date"]);
  assert.equal(args.flags["date"], true);
});

test("缺少命令抛 USAGE", () => {
  assert.throws(() => parseArgs(["--today"]), (err: unknown) => err instanceof CliError && err.code === "USAGE");
});

test("requirePositional 缺失抛 USAGE", () => {
  const args = parseArgs(["categories", "delete"]);
  assert.throws(() => requirePositional(args, 0, "分类 id"), (err: unknown) => err instanceof CliError);
});