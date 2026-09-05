import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const skillDir = join(process.cwd(), "skills", "chronolog");
const skillFile = join(skillDir, "SKILL.md");

test("Chronolog skill 符合最小 Agent Skills 结构", () => {
  assert.equal(existsSync(skillFile), true);
  const source = readFileSync(skillFile, "utf8");
  assert.match(source, /^---\n[\s\S]*?\n---\n/);
  assert.match(source, /^name: chronolog$/m);
  assert.match(source, /^description: .+$/m);
  assert.match(source, /^compatibility: .+$/m);
  assert.equal(existsSync(join(skillDir, "scripts")), false);
});

test("Chronolog skill 覆盖发现、时区、审批、秘密和重试边界", () => {
  const source = readFileSync(skillFile, "utf8");
  for (const expected of [
    "chronolog capabilities",
    "chronolog auth status",
    "--tz Asia/Shanghai",
    "explicit approval",
    "tokens create",
    "`NETWORK` after a write",
  ]) {
    assert.match(source, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.doesNotMatch(source, /^allowed-tools:/m);
});
