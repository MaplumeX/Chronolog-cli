import { request } from "./client.js";
import { resolveAuth } from "./config.js";

/** 已认证的 API 客户端（env/config 解析 + Bearer 注入） */
export async function api(path: string, options = {}): Promise<unknown> {
  const auth = resolveAuth();
  return request(auth.url, auth.token, path, options);
}

export async function listCategories(): Promise<{ id: string; name: string; entryCount: number }[]> {
  const res = (await api("/api/categories")) as {
    categories: { id: string; name: string; entryCount: number }[];
  };
  return res.categories;
}

export async function listTags(): Promise<{ id: string; name: string; entryCount: number }[]> {
  const res = (await api("/api/tags")) as {
    tags: { id: string; name: string; entryCount: number }[];
  };
  return res.tags;
}