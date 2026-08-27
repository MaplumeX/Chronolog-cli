import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

export type AuthSource = "env" | "file" | "none";

export type ResolvedAuth = {
  source: AuthSource;
  url: string;
  token: string;
};

export type FileConfig = {
  url?: string;
  token?: string;
};

export class CliError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "CliError";
  }
}

export function configFilePath(): string {
  const xdg = process.env["XDG_CONFIG_HOME"];
  const base = xdg && xdg.length > 0 ? xdg : join(homedir(), ".config");
  return join(base, "chronolog-cli", "config.json");
}

export function readConfigFile(): FileConfig {
  try {
    const raw = readFileSync(configFilePath(), "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      const obj = parsed as Record<string, unknown>;
      return {
        url: typeof obj["url"] === "string" ? obj["url"] : undefined,
        token: typeof obj["token"] === "string" ? obj["token"] : undefined,
      };
    }
    return {};
  } catch {
    return {};
  }
}

export function writeConfigFile(config: FileConfig): void {
  const file = configFilePath();
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(config, null, 2) + "\n", "utf8");
}

export function clearConfigFile(): void {
  try {
    rmSync(configFilePath());
  } catch {
    // 文件不存在则视为已清除
  }
}

const AUTH_MISSING_HINT =
  "未配置认证。请设置环境变量 CHRONOLOG_URL 和 CHRONOLOG_TOKEN，或运行: chronolog auth login --url <url> --token <token>";

export function resolveAuth(): ResolvedAuth {
  const envUrl = process.env["CHRONOLOG_URL"];
  const envToken = process.env["CHRONOLOG_TOKEN"];
  if (envUrl && envToken) {
    return { source: "env", url: envUrl, token: envToken };
  }
  const file = readConfigFile();
  if (file.url && file.token) {
    return { source: "file", url: file.url, token: file.token };
  }
  throw new CliError("AUTH_MISSING", AUTH_MISSING_HINT);
}

export function maskToken(token: string): string {
  if (token.length <= 8) return "*".repeat(token.length);
  return token.slice(0, 4) + "*".repeat(token.length - 8) + token.slice(-4);
}