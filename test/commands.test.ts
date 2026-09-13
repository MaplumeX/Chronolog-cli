import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { parseArgs } from "../src/args.js";
import { CliError } from "../src/config.js";
import { ApiError } from "../src/client.js";
import { runEntries } from "../src/commands/entries.js";
import { runTimer } from "../src/commands/timer.js";
import { runStats } from "../src/commands/stats.js";
import { runCategories } from "../src/commands/categories.js";
import { runTags } from "../src/commands/tags.js";
import { runGoals } from "../src/commands/goals.js";
import { runAccount } from "../src/commands/account.js";
import { runHealth } from "../src/commands/health.js";

let server: Server | null = null;

const origUrl = process.env["CHRONOLOG_URL"];
const origToken = process.env["CHRONOLOG_TOKEN"];

afterEach(async () => {
  if (server) {
    await new Promise<void>((resolve) => server!.close(() => resolve()));
    server = null;
  }
  if (origUrl === undefined) delete process.env["CHRONOLOG_URL"];
  else process.env["CHRONOLOG_URL"] = origUrl;
  if (origToken === undefined) delete process.env["CHRONOLOG_TOKEN"];
  else process.env["CHRONOLOG_TOKEN"] = origToken;
});

type CapturedRequest = {
  method: string;
  /** 含 query 的完整路径，如 /api/stats/range?tz=UTC */
  url: string;
  body: unknown;
  auth: string | undefined;
};

function startFakeApi(
  handle: (req: CapturedRequest, res: ServerResponse) => void,
): Promise<{ baseUrl: string; requests: CapturedRequest[] }> {
  const requests: CapturedRequest[] = [];
  return new Promise((resolve) => {
    server = createServer((req, res) => {
      let data = "";
      req.on("data", (c: Buffer) => (data += c));
      req.on("end", () => {
        const captured: CapturedRequest = {
          method: req.method ?? "GET",
          url: req.url ?? "/",
          body: data.length > 0 ? (JSON.parse(data) as unknown) : undefined,
          auth: req.headers["authorization"],
        };
        requests.push(captured);
        handle(captured, res);
      });
    });
    server.listen(0, "127.0.0.1", () => {
      const { port } = server!.address() as AddressInfo;
      resolve({ baseUrl: `http://127.0.0.1:${port}`, requests });
    });
  });
}

function json(res: ServerResponse, payload: unknown, status = 200): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

function pathOf(url: string): string {
  return url.split("?")[0];
}

/** 按命令组 dispatch 到对应 run 函数（与 src/index.ts 一致的路由） */
async function run(argv: string[]): Promise<unknown> {
  const args = parseArgs(argv);
  const [root, sub] = args.command;
  switch (root) {
    case "timer":
      return runTimer(args, sub);
    case "entries":
      return runEntries(args, sub);
    case "stats":
      return runStats(args, sub);
    case "categories":
      return runCategories(args, sub);
    case "tags":
      return runTags(args, sub);
    case "goals":
      return runGoals(args, sub);
    case "account":
      return runAccount(args, sub);
    case "health":
      return runHealth(args);
    default:
      throw new Error(`测试不支持命令: ${root}`);
  }
}

function assertUsage(p: Promise<unknown>): Promise<void> {
  return assert.rejects(p, (err: unknown) => err instanceof CliError && err.code === "USAGE");
}

/** 常见的分类/标签列表响应（供名称解析用） */
function seedLists(req: CapturedRequest, res: ServerResponse): boolean {
  if (req.method === "GET" && pathOf(req.url) === "/api/categories") {
    json(res, {
      categories: [
        { id: "cat-1", name: "工作", color: null, parentId: null, archivedAt: null, entryCount: 3 },
        { id: "cat-2", name: "生活", color: 2, parentId: null, archivedAt: null, entryCount: 1 },
      ],
    });
    return true;
  }
  if (req.method === "GET" && pathOf(req.url) === "/api/tags") {
    json(res, {
      tags: [
        { id: "tag-1", name: "deep", color: null, parentId: null, entryCount: 2 },
        { id: "tag-2", name: "urgent", color: 5, parentId: null, entryCount: 1 },
      ],
    });
    return true;
  }
  return false;
}

// ---------- entries ----------

test("entries create：全量 body 字段 + 名称解析", async () => {
  const { baseUrl, requests } = await startFakeApi((req, res) => {
    if (seedLists(req, res)) return;
    if (req.method === "POST" && pathOf(req.url) === "/api/entries") {
      json(res, { entry: { id: "e-9" } }, 201);
      return;
    }
    json(res, { error: { code: "NOT_FOUND", message: "no route" } }, 404);
  });
  process.env["CHRONOLOG_URL"] = baseUrl;
  process.env["CHRONOLOG_TOKEN"] = "tok-123";

  const result = await run([
    "entries", "create",
    "--category", "工作",
    "--description", "手写条目",
    "--tag", "deep", "--tag", "urgent",
    "--started-at", "2026-09-01T10:00:00+08:00",
    "--stopped-at", "2026-09-01T11:00:00+08:00",
  ]);
  assert.deepEqual(result, { entry: { id: "e-9" } });
  const last = requests[requests.length - 1];
  assert.equal(last.method, "POST");
  assert.equal(last.url, "/api/entries");
  assert.deepEqual(last.body, {
    description: "手写条目",
    categoryId: "cat-1",
    tagIds: ["tag-1", "tag-2"],
    startedAt: "2026-09-01T10:00:00+08:00",
    stoppedAt: "2026-09-01T11:00:00+08:00",
  });
  assert.equal(last.auth, "Bearer tok-123");
});

test("entries create：缺必填 flag → USAGE", async () => {
  const { baseUrl } = await startFakeApi((_req, res) => json(res, {}));
  process.env["CHRONOLOG_URL"] = baseUrl;
  process.env["CHRONOLOG_TOKEN"] = "tok-123";
  await assertUsage(run(["entries", "create", "--category", "c", "--description", "d"]));
});

test("entries delete：DELETE /api/entries/:id", async () => {
  const { baseUrl, requests } = await startFakeApi((req, res) => {
    if (req.method === "DELETE" && pathOf(req.url) === "/api/entries/e-1") {
      json(res, { ok: true });
      return;
    }
    json(res, { error: { code: "NOT_FOUND", message: "no route" } }, 404);
  });
  process.env["CHRONOLOG_URL"] = baseUrl;
  process.env["CHRONOLOG_TOKEN"] = "tok-123";
  const result = await run(["entries", "delete", "e-1"]);
  assert.deepEqual(result, { ok: true });
  const last = requests[requests.length - 1];
  assert.equal(last.method, "DELETE");
  assert.equal(last.url, "/api/entries/e-1");
  assert.equal(last.body, undefined);
});

test("entries delete：未知 flag → USAGE", async () => {
  await assertUsage(run(["entries", "delete", "e-1", "--force"]));
});

test("entries merge：POST /api/entries/:id/merge，direction/keep 进 body", async () => {
  const { baseUrl, requests } = await startFakeApi((req, res) => {
    if (req.method === "POST" && pathOf(req.url) === "/api/entries/e-1/merge") {
      json(res, { entry: { id: "e-1", description: "kept" } });
      return;
    }
    json(res, { error: { code: "NOT_FOUND", message: "no route" } }, 404);
  });
  process.env["CHRONOLOG_URL"] = baseUrl;
  process.env["CHRONOLOG_TOKEN"] = "tok-123";
  const result = await run(["entries", "merge", "e-1", "--direction", "prev", "--keep", "self"]);
  assert.deepEqual(result, { entry: { id: "e-1", description: "kept" } });
  const last = requests[requests.length - 1];
  assert.equal(last.method, "POST");
  assert.equal(last.url, "/api/entries/e-1/merge");
  assert.deepEqual(last.body, { direction: "prev", keep: "self" });
});

test("entries merge：缺 direction/keep 或非法枚举 → USAGE", async () => {
  await assertUsage(run(["entries", "merge", "e-1", "--keep", "self"]));
  await assertUsage(run(["entries", "merge", "e-1", "--direction", "prev"]));
  await assertUsage(run(["entries", "merge", "e-1", "--direction", "up", "--keep", "self"]));
  await assertUsage(run(["entries", "merge", "e-1", "--direction", "prev", "--keep", "mine"]));
  await assertUsage(run(["entries", "merge", "--direction", "prev", "--keep", "self"]));
});

// ---------- timer edit ----------

test("timer edit：部分字段仅传 description", async () => {
  const { baseUrl, requests } = await startFakeApi((req, res) => {
    if (req.method === "PATCH" && pathOf(req.url) === "/api/timer/current") {
      json(res, { entry: { id: "e-1" } });
      return;
    }
    json(res, { error: { code: "NOT_FOUND", message: "no route" } }, 404);
  });
  process.env["CHRONOLOG_URL"] = baseUrl;
  process.env["CHRONOLOG_TOKEN"] = "tok-123";
  await run(["timer", "edit", "--description", "新描述"]);
  const last = requests[requests.length - 1];
  assert.equal(last.method, "PATCH");
  assert.equal(last.url, "/api/timer/current");
  assert.deepEqual(last.body, { description: "新描述" });
});

test("timer edit：--tag 出现即全量替换 tagIds（名称解析）", async () => {
  const { baseUrl, requests } = await startFakeApi((req, res) => {
    if (seedLists(req, res)) return;
    if (req.method === "PATCH" && pathOf(req.url) === "/api/timer/current") {
      json(res, { entry: { id: "e-1" } });
      return;
    }
    json(res, { error: { code: "NOT_FOUND", message: "no route" } }, 404);
  });
  process.env["CHRONOLOG_URL"] = baseUrl;
  process.env["CHRONOLOG_TOKEN"] = "tok-123";
  await run(["timer", "edit", "--tag", "deep", "--tag", "urgent"]);
  const last = requests[requests.length - 1];
  assert.deepEqual(last.body, { tagIds: ["tag-1", "tag-2"] });
});

test("timer edit：category 名称解析 + description 组合", async () => {
  const { baseUrl, requests } = await startFakeApi((req, res) => {
    if (seedLists(req, res)) return;
    if (req.method === "PATCH" && pathOf(req.url) === "/api/timer/current") {
      json(res, { entry: { id: "e-1" } });
      return;
    }
    json(res, { error: { code: "NOT_FOUND", message: "no route" } }, 404);
  });
  process.env["CHRONOLOG_URL"] = baseUrl;
  process.env["CHRONOLOG_TOKEN"] = "tok-123";
  await run(["timer", "edit", "--category", "生活", "--description", "x"]);
  const last = requests[requests.length - 1];
  assert.deepEqual(last.body, { description: "x", categoryId: "cat-2" });
});

test("timer edit：一个字段都不传 → USAGE", async () => {
  await assertUsage(run(["timer", "edit"]));
});

// ---------- stats ----------

test("stats range：query 组装（from/to/tagId/rollup/tz）", async () => {
  const { baseUrl, requests } = await startFakeApi((req, res) => {
    if (req.method === "GET" && pathOf(req.url) === "/api/stats/range") {
      json(res, { tz: "Asia/Tokyo", rangeStart: null, rangeEnd: null, days: [], categories: [], tags: [], totalSeconds: 0 });
      return;
    }
    json(res, { error: { code: "NOT_FOUND", message: "no route" } }, 404);
  });
  process.env["CHRONOLOG_URL"] = baseUrl;
  process.env["CHRONOLOG_TOKEN"] = "tok-123";
  const result = await run([
    "stats", "range",
    "--from", "2026-09-01",
    "--to", "2026-09-07",
    "--tag-id", "tag-1",
    "--rollup",
    "--tz", "Asia/Tokyo",
  ]);
  assert.equal((result as { tz: string }).tz, "Asia/Tokyo");
  const last = requests[requests.length - 1];
  assert.equal(last.method, "GET");
  assert.equal(
    last.url,
    "/api/stats/range?tz=Asia%2FTokyo&from=2026-09-01&to=2026-09-07&tagId=tag-1&rollup=true",
  );
});

test("stats range：缺 from/to → USAGE；日期格式非法 → USAGE", async () => {
  await assertUsage(run(["stats", "range", "--from", "2026-09-01"]));
  await assertUsage(run(["stats", "range", "--from", "2026-09-01", "--to", "09/07/2026"]));
});

test("stats today：--rollup 追加 rollup=true", async () => {
  const { baseUrl, requests } = await startFakeApi((req, res) => {
    if (req.method === "GET" && pathOf(req.url) === "/api/stats/today") {
      json(res, { totalSeconds: 0 });
      return;
    }
    json(res, { error: { code: "NOT_FOUND", message: "no route" } }, 404);
  });
  process.env["CHRONOLOG_URL"] = baseUrl;
  process.env["CHRONOLOG_TOKEN"] = "tok-123";
  await run(["stats", "today", "--rollup", "--tz", "Asia/Tokyo"]);
  const last = requests[requests.length - 1];
  assert.equal(last.url, "/api/stats/today?tz=Asia%2FTokyo&rollup=true");
});

test("stats today：无 --rollup 不带 rollup 参数", async () => {
  const { baseUrl, requests } = await startFakeApi((req, res) => {
    if (req.method === "GET" && pathOf(req.url) === "/api/stats/today") {
      json(res, { totalSeconds: 0 });
      return;
    }
    json(res, { error: { code: "NOT_FOUND", message: "no route" } }, 404);
  });
  process.env["CHRONOLOG_URL"] = baseUrl;
  process.env["CHRONOLOG_TOKEN"] = "tok-123";
  await run(["stats", "today", "--tz", "Asia/Tokyo"]);
  const last = requests[requests.length - 1];
  assert.equal(last.url, "/api/stats/today?tz=Asia%2FTokyo");
});

// ---------- goals ----------

test("goals list：tz 进 query", async () => {
  const { baseUrl, requests } = await startFakeApi((req, res) => {
    if (req.method === "GET" && pathOf(req.url) === "/api/goals") {
      json(res, { goals: [] });
      return;
    }
    json(res, { error: { code: "NOT_FOUND", message: "no route" } }, 404);
  });
  process.env["CHRONOLOG_URL"] = baseUrl;
  process.env["CHRONOLOG_TOKEN"] = "tok-123";
  await run(["goals", "list", "--tz", "Asia/Tokyo"]);
  const last = requests[requests.length - 1];
  assert.equal(last.url, "/api/goals?tz=Asia%2FTokyo");
});

test("goals add：枚举/hours/due 转换 + 名称解析", async () => {
  const { baseUrl, requests } = await startFakeApi((req, res) => {
    if (seedLists(req, res)) return;
    if (req.method === "POST" && pathOf(req.url) === "/api/goals") {
      json(res, { id: "g-1" });
      return;
    }
    json(res, { error: { code: "NOT_FOUND", message: "no route" } }, 404);
  });
  process.env["CHRONOLOG_URL"] = baseUrl;
  process.env["CHRONOLOG_TOKEN"] = "tok-123";
  const result = await run([
    "goals", "add", "少刷手机",
    "--icon", "📵",
    "--category", "工作",
    "--tag", "deep",
    "--direction", "lt",
    "--hours", "2",
    "--period", "day",
    "--due", "2026-12-31",
  ]);
  assert.deepEqual(result, { id: "g-1" });
  const last = requests[requests.length - 1];
  assert.equal(last.method, "POST");
  assert.equal(last.url, "/api/goals");
  assert.deepEqual(last.body, {
    name: "少刷手机",
    direction: "lt",
    hours: 2,
    periodUnit: "day",
    icon: "📵",
    categoryId: "cat-1",
    tagId: "tag-1",
    dueDate: "2026-12-31",
  });
});

test("goals add：direction 枚举非法 / hours 非法 / 缺必填 → USAGE", async () => {
  await assertUsage(run(["goals", "add", "x", "--direction", "eq", "--hours", "1", "--period", "day"]));
  await assertUsage(run(["goals", "add", "x", "--direction", "lt", "--hours", "0", "--period", "day"]));
  await assertUsage(run(["goals", "add", "x", "--direction", "lt", "--hours", "1"]));
});

test("goals add：due 日期格式非法 → USAGE", async () => {
  await assertUsage(run(["goals", "add", "x", "--direction", "gt", "--hours", "1", "--period", "week", "--due", "2026/12/31"]));
});

test("goals update：部分字段 + --category none → categoryId null", async () => {
  const { baseUrl, requests } = await startFakeApi((req, res) => {
    if (seedLists(req, res)) return;
    if (req.method === "PATCH" && pathOf(req.url) === "/api/goals/g-1") {
      json(res, { id: "g-1", name: "新名" });
      return;
    }
    json(res, { error: { code: "NOT_FOUND", message: "no route" } }, 404);
  });
  process.env["CHRONOLOG_URL"] = baseUrl;
  process.env["CHRONOLOG_TOKEN"] = "tok-123";
  await run(["goals", "update", "g-1", "--category", "none"]);
  const last = requests[requests.length - 1];
  assert.deepEqual(last.body, { categoryId: null });
});

test("goals update：--category 名称解析 + --tag none → tagId null", async () => {
  const { baseUrl, requests } = await startFakeApi((req, res) => {
    if (seedLists(req, res)) return;
    if (req.method === "PATCH" && pathOf(req.url) === "/api/goals/g-1") {
      json(res, { id: "g-1" });
      return;
    }
    json(res, { error: { code: "NOT_FOUND", message: "no route" } }, 404);
  });
  process.env["CHRONOLOG_URL"] = baseUrl;
  process.env["CHRONOLOG_TOKEN"] = "tok-123";
  await run(["goals", "update", "g-1", "--category", "生活", "--tag", "none"]);
  const last = requests[requests.length - 1];
  assert.deepEqual(last.body, { categoryId: "cat-2", tagId: null });
});

test("goals update：一个字段都不传 → USAGE", async () => {
  await assertUsage(run(["goals", "update", "g-1"]));
});

test("goals delete：DELETE /api/goals/:id", async () => {
  const { baseUrl, requests } = await startFakeApi((req, res) => {
    if (req.method === "DELETE" && pathOf(req.url) === "/api/goals/g-1") {
      json(res, { ok: true });
      return;
    }
    json(res, { error: { code: "NOT_FOUND", message: "no route" } }, 404);
  });
  process.env["CHRONOLOG_URL"] = baseUrl;
  process.env["CHRONOLOG_TOKEN"] = "tok-123";
  const result = await run(["goals", "delete", "g-1"]);
  assert.deepEqual(result, { ok: true });
  const last = requests[requests.length - 1];
  assert.equal(last.method, "DELETE");
  assert.equal(last.url, "/api/goals/g-1");
});

// ---------- categories / tags ----------

test("categories add：--color/--parent 转换", async () => {
  const { baseUrl, requests } = await startFakeApi((req, res) => {
    if (req.method === "POST" && pathOf(req.url) === "/api/categories") {
      json(res, { id: "cat-9" });
      return;
    }
    json(res, { error: { code: "NOT_FOUND", message: "no route" } }, 404);
  });
  process.env["CHRONOLOG_URL"] = baseUrl;
  process.env["CHRONOLOG_TOKEN"] = "tok-123";
  await run(["categories", "add", "子分类", "--color", "3", "--parent", "cat-1"]);
  const last = requests[requests.length - 1];
  assert.deepEqual(last.body, { name: "子分类", color: 3, parentId: "cat-1" });
});

test("categories add：--color none → null；--parent root → null", async () => {
  const { baseUrl, requests } = await startFakeApi((req, res) => {
    if (req.method === "POST" && pathOf(req.url) === "/api/categories") {
      json(res, { id: "cat-9" });
      return;
    }
    json(res, { error: { code: "NOT_FOUND", message: "no route" } }, 404);
  });
  process.env["CHRONOLOG_URL"] = baseUrl;
  process.env["CHRONOLOG_TOKEN"] = "tok-123";
  await run(["categories", "add", "顶层", "--color", "none", "--parent", "root"]);
  const last = requests[requests.length - 1];
  assert.deepEqual(last.body, { name: "顶层", color: null, parentId: null });
});

test("categories add：--color 越界/非数字 → USAGE", async () => {
  await assertUsage(run(["categories", "add", "x", "--color", "9"]));
  await assertUsage(run(["categories", "add", "x", "--color", "red"]));
});

test("categories rename：部分字段（仅 color）", async () => {
  const { baseUrl, requests } = await startFakeApi((req, res) => {
    if (req.method === "PATCH" && pathOf(req.url) === "/api/categories/cat-1") {
      json(res, { id: "cat-1", color: 2 });
      return;
    }
    json(res, { error: { code: "NOT_FOUND", message: "no route" } }, 404);
  });
  process.env["CHRONOLOG_URL"] = baseUrl;
  process.env["CHRONOLOG_TOKEN"] = "tok-123";
  await run(["categories", "rename", "cat-1", "--color", "2"]);
  const last = requests[requests.length - 1];
  assert.deepEqual(last.body, { color: 2 });
});

test("categories rename：name + parent none 组合", async () => {
  const { baseUrl, requests } = await startFakeApi((req, res) => {
    if (req.method === "PATCH" && pathOf(req.url) === "/api/categories/cat-1") {
      json(res, { id: "cat-1" });
      return;
    }
    json(res, { error: { code: "NOT_FOUND", message: "no route" } }, 404);
  });
  process.env["CHRONOLOG_URL"] = baseUrl;
  process.env["CHRONOLOG_TOKEN"] = "tok-123";
  await run(["categories", "rename", "cat-1", "--name", "新名", "--parent", "none"]);
  const last = requests[requests.length - 1];
  assert.deepEqual(last.body, { name: "新名", parentId: null });
});

test("categories rename：一个字段都不传 → USAGE", async () => {
  await assertUsage(run(["categories", "rename", "cat-1"]));
});

test("categories archive / unarchive", async () => {
  const { baseUrl, requests } = await startFakeApi((req, res) => {
    if (req.method === "POST" && (pathOf(req.url) === "/api/categories/cat-1/archive" || pathOf(req.url) === "/api/categories/cat-1/unarchive")) {
      json(res, { id: "cat-1", archivedAt: pathOf(req.url).endsWith("/unarchive") ? null : "2026-09-02T00:00:00Z" });
      return;
    }
    json(res, { error: { code: "NOT_FOUND", message: "no route" } }, 404);
  });
  process.env["CHRONOLOG_URL"] = baseUrl;
  process.env["CHRONOLOG_TOKEN"] = "tok-123";
  const archived = (await run(["categories", "archive", "cat-1"])) as { archivedAt: string };
  assert.notEqual(archived.archivedAt, null);
  const unarchived = (await run(["categories", "unarchive", "cat-1"])) as { archivedAt: string | null };
  assert.equal(unarchived.archivedAt, null);
  const methods = requests.slice(-2).map((r) => `${r.method} ${r.url}`);
  assert.deepEqual(methods, [
    "POST /api/categories/cat-1/archive",
    "POST /api/categories/cat-1/unarchive",
  ]);
});

test("tags add：--color/--parent 转换", async () => {
  const { baseUrl, requests } = await startFakeApi((req, res) => {
    if (req.method === "POST" && pathOf(req.url) === "/api/tags") {
      json(res, { id: "tag-9" });
      return;
    }
    json(res, { error: { code: "NOT_FOUND", message: "no route" } }, 404);
  });
  process.env["CHRONOLOG_URL"] = baseUrl;
  process.env["CHRONOLOG_TOKEN"] = "tok-123";
  await run(["tags", "add", "子标签", "--color", "8", "--parent", "tag-1"]);
  const last = requests[requests.length - 1];
  assert.deepEqual(last.body, { name: "子标签", color: 8, parentId: "tag-1" });
});

test("tags rename：部分字段 + 哨兵值", async () => {
  const { baseUrl, requests } = await startFakeApi((req, res) => {
    if (req.method === "PATCH" && pathOf(req.url) === "/api/tags/tag-1") {
      json(res, { id: "tag-1" });
      return;
    }
    json(res, { error: { code: "NOT_FOUND", message: "no route" } }, 404);
  });
  process.env["CHRONOLOG_URL"] = baseUrl;
  process.env["CHRONOLOG_TOKEN"] = "tok-123";
  await run(["tags", "rename", "tag-1", "--color", "null", "--parent", "root"]);
  const last = requests[requests.length - 1];
  assert.deepEqual(last.body, { color: null, parentId: null });
  await assertUsage(run(["tags", "rename", "tag-1"]));
});

test("tags delete：被 goal 引用 → 409 CONFLICT 错误透传", async () => {
  const { baseUrl } = await startFakeApi((_req, res) => {
    json(res, { error: { code: "CONFLICT", message: "该标签已被目标引用" } }, 409);
  });
  process.env["CHRONOLOG_URL"] = baseUrl;
  process.env["CHRONOLOG_TOKEN"] = "tok-123";
  await assert.rejects(
    run(["tags", "delete", "tag-1"]),
    (err: unknown) => err instanceof ApiError && err.code === "CONFLICT" && err.statusCode === 409 && err.message === "该标签已被目标引用",
  );
});

// ---------- account ----------

test("account profile：部分字段，--display-name 空串原样进 body", async () => {
  const { baseUrl, requests } = await startFakeApi((req, res) => {
    if (req.method === "PATCH" && pathOf(req.url) === "/api/profile") {
      json(res, { id: "u-1", username: "alice", displayName: null });
      return;
    }
    json(res, { error: { code: "NOT_FOUND", message: "no route" } }, 404);
  });
  process.env["CHRONOLOG_URL"] = baseUrl;
  process.env["CHRONOLOG_TOKEN"] = "tok-123";
  const result = await run(["account", "profile", "--display-name", ""]);
  assert.deepEqual(result, { id: "u-1", username: "alice", displayName: null });
  const last = requests[requests.length - 1];
  assert.deepEqual(last.body, { displayName: "" });
});

test("account profile：一个字段都不传 → USAGE", async () => {
  await assertUsage(run(["account", "profile"]));
});

test("account profile：--timezone none 清除，--continuous-timing 转 boolean", async () => {
  const { baseUrl, requests } = await startFakeApi((req, res) => {
    if (req.method === "PATCH" && pathOf(req.url) === "/api/profile") {
      json(res, { id: "u-1", username: "alice", timezone: null, continuousTiming: true });
      return;
    }
    json(res, { error: { code: "NOT_FOUND", message: "no route" } }, 404);
  });
  process.env["CHRONOLOG_URL"] = baseUrl;
  process.env["CHRONOLOG_TOKEN"] = "tok-123";
  const result = await run([
    "account", "profile", "--timezone", "none", "--continuous-timing", "true",
  ]);
  assert.deepEqual(result, { id: "u-1", username: "alice", timezone: null, continuousTiming: true });
  const last = requests[requests.length - 1];
  assert.deepEqual(last.body, { timezone: "", continuousTiming: true });
});

test("account profile：--timezone 传 IANA 名，--continuous-timing false 原样进 body", async () => {
  const { baseUrl, requests } = await startFakeApi((req, res) => {
    if (req.method === "PATCH" && pathOf(req.url) === "/api/profile") {
      json(res, { id: "u-1", username: "alice", timezone: "Asia/Shanghai", continuousTiming: false });
      return;
    }
    json(res, { error: { code: "NOT_FOUND", message: "no route" } }, 404);
  });
  process.env["CHRONOLOG_URL"] = baseUrl;
  process.env["CHRONOLOG_TOKEN"] = "tok-123";
  await run(["account", "profile", "--timezone", "Asia/Shanghai", "--continuous-timing", "false"]);
  const last = requests[requests.length - 1];
  assert.deepEqual(last.body, { timezone: "Asia/Shanghai", continuousTiming: false });
});

test("account profile：--continuous-timing 非法值 → USAGE", async () => {
  await assertUsage(run(["account", "profile", "--continuous-timing", "yes"]));
});

test("account password：body 含新旧密码且不出现在输出", async () => {
  const { baseUrl, requests } = await startFakeApi((req, res) => {
    if (req.method === "PATCH" && pathOf(req.url) === "/api/account/password") {
      json(res, { ok: true });
      return;
    }
    json(res, { error: { code: "NOT_FOUND", message: "no route" } }, 404);
  });
  process.env["CHRONOLOG_URL"] = baseUrl;
  process.env["CHRONOLOG_TOKEN"] = "tok-123";
  const result = await run(["account", "password", "--current-password", "old-secret", "--new-password", "new-secret"]);
  assert.deepEqual(result, { ok: true });
  const last = requests[requests.length - 1];
  assert.deepEqual(last.body, { currentPassword: "old-secret", newPassword: "new-secret" });
  await assertUsage(run(["account", "password", "--current-password", "old-secret"]));
});

test("account delete：body 带 password 确认", async () => {
  const { baseUrl, requests } = await startFakeApi((req, res) => {
    if (req.method === "DELETE" && pathOf(req.url) === "/api/account") {
      json(res, { ok: true });
      return;
    }
    json(res, { error: { code: "NOT_FOUND", message: "no route" } }, 404);
  });
  process.env["CHRONOLOG_URL"] = baseUrl;
  process.env["CHRONOLOG_TOKEN"] = "tok-123";
  const result = await run(["account", "delete", "--password", "confirm-secret"]);
  assert.deepEqual(result, { ok: true });
  const last = requests[requests.length - 1];
  assert.equal(last.method, "DELETE");
  assert.deepEqual(last.body, { password: "confirm-secret" });
  await assertUsage(run(["account", "delete"]));
});

test("account meta：无认证（不带 token）", async () => {
  const { baseUrl, requests } = await startFakeApi((req, res) => {
    if (req.method === "GET" && pathOf(req.url) === "/api/meta") {
      json(res, { registrationOpen: true });
      return;
    }
    json(res, { error: { code: "NOT_FOUND", message: "no route" } }, 404);
  });
  // 只设 URL，不设 token —— meta 不应要求认证
  process.env["CHRONOLOG_URL"] = baseUrl;
  delete process.env["CHRONOLOG_TOKEN"];
  const result = await run(["account", "meta"]);
  assert.deepEqual(result, { registrationOpen: true });
  const last = requests[requests.length - 1];
  assert.equal(last.url, "/api/meta");
  assert.notEqual(last.auth, "Bearer tok-123");
});

// ---------- health ----------

test("health：无认证 GET /api/health（--url 覆盖）", async () => {
  const { baseUrl, requests } = await startFakeApi((req, res) => {
    if (req.method === "GET" && pathOf(req.url) === "/api/health") {
      json(res, { ok: true });
      return;
    }
    json(res, { error: { code: "NOT_FOUND", message: "no route" } }, 404);
  });
  // 不设任何 env，用 --url flag
  delete process.env["CHRONOLOG_URL"];
  delete process.env["CHRONOLOG_TOKEN"];
  const result = await run(["health", "--url", baseUrl]);
  assert.deepEqual(result, { ok: true });
  const last = requests[requests.length - 1];
  assert.equal(last.url, "/api/health");
  assert.notEqual(last.auth, "Bearer tok-123");
});

test("health：无 --url 时从 env 宽松读取（token 不要求）", async () => {
  const { baseUrl, requests } = await startFakeApi((req, res) => {
    if (req.method === "GET" && pathOf(req.url) === "/api/health") {
      json(res, { ok: true });
      return;
    }
    json(res, { error: { code: "NOT_FOUND", message: "no route" } }, 404);
  });
  process.env["CHRONOLOG_URL"] = baseUrl;
  delete process.env["CHRONOLOG_TOKEN"];
  const result = await run(["health"]);
  assert.deepEqual(result, { ok: true });
  assert.equal(requests[requests.length - 1].url, "/api/health");
});

test("health：无 url 且无配置 → AUTH_MISSING", async () => {
  delete process.env["CHRONOLOG_URL"];
  delete process.env["CHRONOLOG_TOKEN"];
  await assert.rejects(
    run(["health"]),
    (err: unknown) => err instanceof CliError && err.code === "AUTH_MISSING",
  );
});
