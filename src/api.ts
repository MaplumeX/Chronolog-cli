import { request } from "./client.js";
import { resolveAuth } from "./config.js";

/** 已认证的 API 客户端（env/config 解析 + Bearer 注入） */
export async function api(path: string, options = {}): Promise<unknown> {
  const auth = resolveAuth();
  return request(auth.url, auth.token, path, options);
}

export type Category = {
  id: string;
  name: string;
  color: number | null;
  parentId: string | null;
  archivedAt: string | null;
  entryCount: number;
};

export type Tag = {
  id: string;
  name: string;
  color: number | null;
  parentId: string | null;
  entryCount: number;
};

export async function listCategories(): Promise<Category[]> {
  const res = (await api("/api/categories")) as { categories: Category[] };
  return res.categories;
}

export async function listTags(): Promise<Tag[]> {
  const res = (await api("/api/tags")) as { tags: Tag[] };
  return res.tags;
}
