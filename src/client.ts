import { CliError } from "./config.js";

const TIMEOUT_MS = 30_000;

export class ApiError extends CliError {
  constructor(
    public statusCode: number,
    code: string,
    message: string,
  ) {
    super(code, message);
    this.name = "ApiError";
  }
}

type Method = "GET" | "POST" | "PATCH" | "DELETE";

export type RequestOptions = {
  method?: Method;
  body?: unknown;
  query?: Record<string, string | undefined>;
};

export async function request(
  baseUrl: string,
  token: string,
  path: string,
  options: RequestOptions = {},
): Promise<unknown> {
  const url = new URL(path, baseUrl);
  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (value !== undefined) url.searchParams.set(key, value);
    }
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: options.method ?? "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new ApiError(0, "NETWORK", `请求超时（${TIMEOUT_MS / 1000}s）: ${url}`);
    }
    throw new ApiError(0, "NETWORK", `网络错误: ${err instanceof Error ? err.message : String(err)}`);
  }

  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = text.length > 0 ? JSON.parse(text) : null;
  } catch {
    if (!res.ok) {
      // 非 2xx 且响应体不是 JSON（网关错误页等）→ UNKNOWN
      throw new ApiError(res.status, "UNKNOWN", `HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
    // 2xx 但响应不是 JSON（比如 URL 指向了别的服务或 HTML 页）→ PARSE
    throw new ApiError(res.status, "PARSE", `响应不是合法 JSON (HTTP ${res.status}): ${url}`);
  }

  if (!res.ok) {
    if (parsed && typeof parsed === "object" && "error" in parsed) {
      const errObj = (parsed as { error: unknown }).error;
      if (errObj && typeof errObj === "object" && "code" in errObj && "message" in errObj) {
        const e = errObj as { code: unknown; message: unknown };
        throw new ApiError(
          res.status,
          typeof e.code === "string" ? e.code : "UNKNOWN",
          typeof e.message === "string" ? e.message : JSON.stringify(e.message),
        );
      }
    }
    throw new ApiError(res.status, "UNKNOWN", `HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  return parsed;
}