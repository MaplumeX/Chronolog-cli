import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { request, ApiError } from "../src/client.js";

let server: Server | null = null;
let baseURL = "";

afterEach(async () => {
  if (server) {
    await new Promise<void>((resolve) => server!.close(() => resolve()));
    server = null;
  }
});

function startServer(handler: (req: import("node:http").IncomingMessage, res: import("node:http").ServerResponse) => void): Promise<string> {
  return new Promise((resolve) => {
    server = createServer(handler);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server!.address() as AddressInfo;
      resolve(`http://127.0.0.1:${port}`);
    });
  });
}

test("2xx 透传 JSON 响应体", async () => {
  baseURL = await startServer((req, res) => {
    assert.equal(req.headers["authorization"], "Bearer tok-123");
    assert.equal(req.url, "/api/ping?tz=Asia%2FShanghai");
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: true, echo: "hi" }));
  });
  const result = await request(baseURL, "tok-123", "/api/ping", { query: { tz: "Asia/Shanghai" } });
  assert.deepEqual(result, { ok: true, echo: "hi" });
});

test("POST body 正确发送", async () => {
  baseURL = await startServer((req, res) => {
    let data = "";
    req.on("data", (c: Buffer) => (data += c));
    req.on("end", () => {
      assert.deepEqual(JSON.parse(data), { name: "x" });
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ id: "1" }));
    });
  });
  const result = await request(baseURL, "t", "/api/x", { method: "POST", body: { name: "x" } });
  assert.deepEqual(result, { id: "1" });
});

test("非 2xx 服务端错误体归一化（AppError 格式）", async () => {
  baseURL = await startServer((req, res) => {
    res.statusCode = 409;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: { code: "OVERLAP", message: "该时间段与其它条目重叠" } }));
  });
  try {
    await request(baseURL, "t", "/api/entries/1", { method: "PATCH", body: {} });
    assert.fail("应抛出 ApiError");
  } catch (err) {
    assert.ok(err instanceof ApiError);
    assert.equal(err.statusCode, 409);
    assert.equal(err.code, "OVERLAP");
    assert.equal(err.message, "该时间段与其它条目重叠");
  }
});

test("非 2xx 且响应体不是 JSON → UNKNOWN", async () => {
  baseURL = await startServer((req, res) => {
    res.statusCode = 500;
    res.end("oops");
  });
  try {
    await request(baseURL, "t", "/api/x");
    assert.fail("应抛出 ApiError");
  } catch (err) {
    assert.ok(err instanceof ApiError);
    assert.equal(err.code, "UNKNOWN");
    assert.equal(err.statusCode, 500);
  }
});

test("2xx 但响应不是 JSON → PARSE", async () => {
  baseURL = await startServer((req, res) => {
    res.setHeader("Content-Type", "text/html");
    res.end("<html>not chronolog</html>");
  });
  try {
    await request(baseURL, "t", "/api/x");
    assert.fail("应抛出 ApiError");
  } catch (err) {
    assert.ok(err instanceof ApiError);
    assert.equal(err.code, "PARSE");
  }
});

test("网络错误（连接拒绝）→ NETWORK", async () => {
  try {
    await request("http://127.0.0.1:1", "t", "/api/x");
    assert.fail("应抛出 ApiError");
  } catch (err) {
    assert.ok(err instanceof ApiError);
    assert.equal(err.code, "NETWORK");
  }
});

test("401 服务端错误归一化", async () => {
  baseURL = await startServer((req, res) => {
    res.statusCode = 401;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: { code: "UNAUTHORIZED", message: "请先登录" } }));
  });
  try {
    await request(baseURL, "bad-token", "/api/auth/me");
    assert.fail("应抛出 ApiError");
  } catch (err) {
    assert.ok(err instanceof ApiError);
    assert.equal(err.code, "UNAUTHORIZED");
  }
});