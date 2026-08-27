import { ApiError } from "./client.js";
import { listCategories, listTags } from "./api.js";

/**
 * 把 `--category` / `--tag` 的值解析为 id：
 * 先精确匹配名称（唯一命中则用之），否则视为已是 id 直接返回。
 */
export async function resolveCategory(value: string): Promise<string> {
  const categories = await listCategories();
  const matches = categories.filter((c) => c.name === value);
  if (matches.length === 1) return matches[0].id;
  if (matches.length > 1) {
    throw new ApiError(404, "NOT_FOUND", `分类名称不唯一: ${value}（匹配到 ${matches.length} 个，请用 id）`);
  }
  return value;
}

export async function resolveTag(value: string): Promise<string> {
  const tags = await listTags();
  const matches = tags.filter((t) => t.name === value);
  if (matches.length === 1) return matches[0].id;
  if (matches.length > 1) {
    throw new ApiError(404, "NOT_FOUND", `标签名称不唯一: ${value}（匹配到 ${matches.length} 个，请用 id）`);
  }
  return value;
}

export async function resolveTags(values: string[]): Promise<string[]> {
  if (values.length === 0) return [];
  return Promise.all(values.map((v) => resolveTag(v)));
}