import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  configFilePath,
  readConfigFile,
  resolveAuth,
  writeConfigFile,
  clearConfigFile,
  maskToken,
  resolveUrlLoose,
  CliError,
} from "../src/config.js";

let tmpDir: string;
const origXdg = process.env["XDG_CONFIG_HOME"];
const origUrl = process.env["CHRONOLOG_URL"];
const origToken = process.env["CHRONOLOG_TOKEN"];

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "chronolog-cli-test-"));
  process.env["XDG_CONFIG_HOME"] = tmpDir;
  delete process.env["CHRONOLOG_URL"];
  delete process.env["CHRONOLOG_TOKEN"];
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
  if (origXdg === undefined) delete process.env["XDG_CONFIG_HOME"];
  else process.env["XDG_CONFIG_HOME"] = origXdg;
  if (origUrl === undefined) delete process.env["CHRONOLOG_URL"];
  else process.env["CHRONOLOG_URL"] = origUrl;
  if (origToken === undefined) delete process.env["CHRONOLOG_TOKEN"];
  else process.env["CHRONOLOG_TOKEN"] = origToken;
});

test("configFilePath 遵循 XDG_CONFIG_HOME", () => {
  assert.equal(configFilePath(), join(tmpDir, "chronolog-cli", "config.json"));
});

test("env 优先于配置文件", () => {
  writeConfigFile({ url: "http://file", token: "file-token" });
  process.env["CHRONOLOG_URL"] = "http://env";
  process.env["CHRONOLOG_TOKEN"] = "env-token";
  const auth = resolveAuth();
  assert.equal(auth.source, "env");
  assert.equal(auth.url, "http://env");
  assert.equal(auth.token, "env-token");
});

test("无 env 时读配置文件", () => {
  writeConfigFile({ url: "http://file", token: "file-token" });
  const auth = resolveAuth();
  assert.equal(auth.source, "file");
  assert.equal(auth.url, "http://file");
});

test("都没有时抛 AUTH_MISSING 且提示配置方法", () => {
  try {
    resolveAuth();
    assert.fail("应抛出 CliError");
  } catch (err) {
    assert.ok(err instanceof CliError);
    assert.equal(err.code, "AUTH_MISSING");
    assert.match(err.message, /auth login --url/);
    assert.match(err.message, /CHRONOLOG_URL/);
  }
});

test("配置文件损坏时视为空配置", () => {
  mkdirSync(join(tmpDir, "chronolog-cli"), { recursive: true });
  writeFileSync(join(tmpDir, "chronolog-cli", "config.json"), "not json{", "utf8");
  assert.deepEqual(readConfigFile(), {});
  assert.throws(() => resolveAuth(), (err: unknown) => err instanceof CliError && err.code === "AUTH_MISSING");
});

test("logout（clearConfigFile）删除配置文件", () => {
  writeConfigFile({ url: "http://x", token: "t" });
  clearConfigFile();
  assert.deepEqual(readConfigFile(), {});
});

test("clearConfigFile 在文件不存在时不抛错", () => {
  clearConfigFile();
});

test("maskToken 掩码保留首尾", () => {
  assert.equal(maskToken("abcd12345678wxyz"), "abcd********wxyz");
  assert.equal(maskToken("short"), "*****");
});

test("resolveUrlLoose：env 优先，无认证 token 也可读 url", () => {
  writeConfigFile({ url: "http://file", token: undefined });
  assert.equal(resolveUrlLoose(), "http://file");
  process.env["CHRONOLOG_URL"] = "http://env";
  assert.equal(resolveUrlLoose(), "http://env");
});

test("resolveUrlLoose：env 与配置均无 url 时返回 undefined（不抛错）", () => {
  assert.equal(resolveUrlLoose(), undefined);
});