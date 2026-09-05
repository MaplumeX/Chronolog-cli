import { readFileSync } from "node:fs";
import { dirname, join, parse } from "node:path";
import { fileURLToPath } from "node:url";
import { CliError } from "./config.js";

let cachedVersion: string | undefined;

export function packageVersion(): string {
  if (cachedVersion !== undefined) return cachedVersion;

  let directory = dirname(fileURLToPath(import.meta.url));
  const root = parse(directory).root;
  while (true) {
    try {
      const pkg = JSON.parse(readFileSync(join(directory, "package.json"), "utf8")) as {
        name?: unknown;
        version?: unknown;
      };
      if (pkg.name === "chronolog-cli" && typeof pkg.version === "string") {
        cachedVersion = pkg.version;
        return pkg.version;
      }
    } catch {
      // 继续向上寻找所属 package.json。
    }
    if (directory === root) break;
    directory = dirname(directory);
  }
  throw new CliError("INTERNAL", "无法读取 chronolog-cli 版本");
}
