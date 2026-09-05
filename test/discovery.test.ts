import { test } from "node:test";
import assert from "node:assert/strict";
import { COMMANDS, findCommand, rootNames } from "../src/catalog.js";
import { capabilities, discoveryOutput, helpInfo, versionInfo } from "../src/discovery.js";
import { CliError } from "../src/config.js";
import { packageVersion } from "../src/version.js";

test("命令目录路径唯一且可反查", () => {
  const paths = COMMANDS.map((command) => command.path.join(" "));
  assert.equal(new Set(paths).size, paths.length);
  for (const command of COMMANDS) assert.equal(findCommand(command.path), command);
  assert.deepEqual(rootNames(), ["auth", "timer", "entries", "stats", "goals", "categories", "tags", "tokens", "account", "health"]);
});

test("命令目录覆盖当前全部公开命令", () => {
  assert.deepEqual(
    COMMANDS.map((command) => command.path.join(" ")).sort(),
    [
      "account delete", "account meta", "account password", "account profile",
      "auth login", "auth logout", "auth register", "auth status",
      "categories add", "categories archive", "categories delete", "categories list", "categories rename", "categories unarchive",
      "entries create", "entries delete", "entries list", "entries update",
      "goals add", "goals delete", "goals list", "goals update",
      "health",
      "stats range", "stats today",
      "tags add", "tags delete", "tags list", "tags rename",
      "timer edit", "timer start", "timer status", "timer stop",
      "tokens create", "tokens delete", "tokens list",
    ].sort(),
  );
});

test("根帮助支持文本和 JSON", () => {
  const text = discoveryOutput(["--help"]);
  assert.equal(text?.format, "text");
  assert.match((text as { value: string }).value, new RegExp(`chronolog ${packageVersion().replaceAll(".", "\\.")}`));
  assert.match((text as { value: string }).value, /timer/);

  const json = discoveryOutput(["help", "--json"]);
  assert.equal(json?.format, "json");
  assert.equal((json as { value: { level: string } }).value.level, "root");
});

test("命令组和子命令帮助来自目录", () => {
  const group = helpInfo(["timer"]);
  assert.equal(group.level, "group");
  if (group.level === "group") assert.equal(group.commands.length, 4);

  const command = discoveryOutput(["timer", "start", "--help"]);
  assert.equal(command?.format, "text");
  assert.match((command as { value: string }).value, /--category/);

  const structured = discoveryOutput(["help", "timer", "start", "--json"]);
  assert.equal(structured?.format, "json");
  assert.equal((structured as { value: { level: string } }).value.level, "command");
});

test("version 支持文本和 JSON", () => {
  assert.deepEqual(discoveryOutput(["--version"]), { format: "text", value: `chronolog ${packageVersion()}` });
  assert.deepEqual(discoveryOutput(["version", "--json"]), { format: "json", value: versionInfo() });
});

test("capabilities 包含全部命令和输出契约", () => {
  const value = capabilities() as { commands: unknown[]; output: { operationalSuccess: string } };
  assert.equal(value.commands.length, COMMANDS.length);
  assert.equal(value.output.operationalSuccess, "single-json-object");
});

test("未知帮助路径抛 USAGE", () => {
  assert.throws(
    () => discoveryOutput(["help", "missing"]),
    (err: unknown) => err instanceof CliError && err.code === "USAGE",
  );
});
