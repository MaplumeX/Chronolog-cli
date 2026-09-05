# CLI Guidelines

> Conventions for the `chronolog` CLI (this repo). Applies to all code under `src/` and `test/`.

---

## Overview

The CLI is an agent-facing JSON client for the Chronolog server (`../Chronolog`). Contracts below are executable rules — changing any of them requires updating tests and this spec together.

---

## Output Contract (CRITICAL)

- Operational success: single JSON object to stdout via `JSON.stringify(result)`, exit code 0. No extra prints, no pretty tables, no colors on stdout.
- Failure: `{"error":{"code":"...","message":"..."}}` to stdout, one-line human summary to stderr, exit code 1.
- Human discovery is the only successful text-output exception: `--help`, `help`, `--version`, and `version` write deterministic plain text to stdout with exit code 0.
- Structured discovery uses one JSON object: `help --json`, `version --json`, and `capabilities`. Discovery requires no auth and performs no network requests.
- Never log secrets (token, password) to stdout. `auth status` / `auth login` print masked tokens only (first 4 + last 4).

### Error Codes

| Source | Codes |
|---|---|
| Server (transparent, from AppError body) | `UNAUTHORIZED` `NOT_FOUND` `CONFLICT` `OVERLAP` `VALIDATION` |
| CLI-generated | `AUTH_MISSING` `NETWORK` (timeout/connection) `USAGE` (bad args) `PARSE` (2xx but non-JSON body) `UNKNOWN` (non-2xx non-JSON body) `INTERNAL` |

`AUTH_MISSING` message must mention both config methods (env vars and `auth login`).

---

## Auth Contract

Precedence: env (`CHRONOLOG_URL` + `CHRONOLOG_TOKEN`) → config file `~/.config/chronolog-cli/config.json` (respects `XDG_CONFIG_HOME`) → `AUTH_MISSING` error.

Config file shape: `{ "url": string, "token": string }`. Token stored in plaintext (accepted tradeoff for self-hosted personal use; do not add OS keychain). On POSIX, every write must create or restore the file mode to `0600`.

---

## Command Catalog and Argv Contract (`src/catalog.ts`, `src/args.ts`)

- `src/catalog.ts` is the single source of truth for public command paths, generic argument shapes, help/capability metadata, auth requirements, and operation classification. Handler code remains authoritative for domain value checks and API requests.
- First non-flag segments = command path (e.g. `timer start`); missing or extra positional segments beyond the catalog signature → `USAGE`.
- `--flag value` and `--flag=value` are both valid for value flags; bare catalog-declared boolean flags are `true`; catalog-declared repeatable flags aggregate into a string array.
- Boolean flags do not consume a following positional and reject `--flag=value`. Missing values, unknown flags, and repeated non-repeatable flags → `USAGE`.
- Text help and structured capability output must be rendered from the catalog, not maintained as a second command list.

---

## Scenario: Extend the Public CLI Surface

### 1. Scope / Trigger

Use this contract whenever adding or changing a public command, positional argument, flag, discovery invocation, or config-writing authentication flow. It prevents the parser, help output, capability manifest, handlers, and tests from drifting apart.

### 2. Signatures

- Operational command: `chronolog <root> [subcommand] [positionals] [flags]`.
- Discovery: `chronolog help [root] [subcommand] [--json]`, `chronolog version [--json]`, and `chronolog capabilities`.
- Catalog lookup: `findCommand(path: readonly string[]): CommandSpec | undefined`.
- Config write: `writeConfigFile(config: { url: string; token: string }): void`.

### 3. Contracts

- Every operational command path and generic argument shape appears exactly once in `COMMANDS`.
- `CommandSpec` exposes `path`, `usage`, `auth`, `operation`, `positionals`, `flags`, and representative `errors`.
- Discovery performs no authentication or network I/O. Text and JSON help are projections of the same `CommandSpec` data.
- Operational stdout remains one JSON object. Human discovery is the only successful text exception.
- Config writes preserve the JSON shape and enforce mode `0600` on POSIX.

### 4. Validation & Error Matrix

| Condition | Result |
|---|---|
| Unknown flag on a known command | `USAGE` |
| Missing value for a string flag | `USAGE` |
| `--boolean=value` | `USAGE` |
| Repeated non-repeatable flag | `USAGE` |
| Missing or surplus positional | `USAGE` |
| Unknown help path or invalid discovery arguments | Existing JSON `USAGE` error envelope |
| Owning `chronolog-cli` package version cannot be found | `INTERNAL` |
| POSIX permission hardening fails | Normal CLI failure; never silently ignored |

### 5. Good / Base / Bad Cases

- Good: `chronolog timer start --category work --tag focused --tag billable` preserves repeated tags.
- Base: `chronolog help timer start --json` returns one command metadata object without auth.
- Bad: `chronolog entries list --today=true` fails with `USAGE`; it must not coerce the string to truthy.

### 6. Tests Required

- Catalog: assert unique paths and exact coverage of every dispatchable command.
- Parser: assert both value syntaxes, repeated-array flags, boolean non-consumption, and every generic `USAGE` branch.
- Discovery: assert root/group/command text help and equivalent JSON, version forms, and complete capabilities.
- Compatibility: retain handler/request tests to prove valid invocations produce unchanged API paths and bodies.
- Config: assert mode `0600` after both initial creation and overwrite on POSIX.
- Packaging: run `npm pack --dry-run` and assert `dist/` is present while `skills/` is absent.

### 7. Wrong vs Correct

```typescript
// Wrong: add a handler-only flag; discovery and generic validation drift.
const value = getFlag(args, "new-flag");

// Correct: declare the flag in the command's CommandSpec, then consume it in the handler.
flags: [flag("new-flag", "string", "Meaning", { value: "value" })];
```

---

## API Client Rules (`src/client.ts`)

- Always send `Authorization: Bearer <token>`; 30s timeout via `AbortSignal.timeout` (TimeoutError → `NETWORK`).
- Non-2xx: parse server body `{error:{code,message}}` and rethrow normalized. Non-JSON non-2xx body → `UNKNOWN` (not `PARSE` — `PARSE` is reserved for non-JSON 2xx success bodies).
- Server API base: `<url>/api/...`. Field names must match server zod schemas exactly: `categoryId`, `tagIds`, `description`, `startedAt`, `stoppedAt`, `tz`, `date`, `tagId`, `name`.

---

## Name Resolution (`src/resolve.ts`)

`--category` / `--tag` values: exact unique name match (via `GET /api/categories|tags`) → use its id; otherwise pass value through as-is (server validates ownership and returns `NOT_FOUND`). Do not pre-validate locally.

Applies to every command that takes `--category` / `--tag`: `timer start`, `timer edit`, `entries create`, `entries update`, `goals add`, `goals update`. In `goals update`, the sentinels `none` / `null` bypass resolution and mean "clear the association" (send `null`).

## Value Conversion (`src/commands/util.ts`)

CLI flags are strings; convert to API types with these helpers (all invalid input → `USAGE`):

- `parseColor`: `"1"`–`"8"` → number; `none`/`null` → `null` (clear). Out-of-range or non-integer → `USAGE`.
- `parseParentId`: `none`/`root` → `null` (promote to top level); any other value passed through as id.
- `parseHours`: `Number()`; NaN or ≤ 0 → `USAGE` (upper bound ≤ 1000 is server-side).
- `parseEnum`: whitelist validation (`lt|gt`, `day|week|month`).
- `parseDateParam`: `YYYY-MM-DD` regex check; exact calendar validation is server-side.

## Partial-Field Updates

Commands PATCHing a subset of fields (`timer edit`, `goals update`, `categories|tags rename`, `account profile`): `undefined` = flag absent = field omitted from body entirely. If the user provides no mutable field at all → `USAGE` ("至少提供一个字段"). `tagIds` exception: `--tag` present means full replacement (same as `entries update`); absent means omit `tagIds`.

## Unauthenticated Commands

`health` and `account meta` must NOT go through `api()` (it requires full auth). They use `request(url, "", path)` — the empty token still sends `Authorization: Bearer ` harmlessly. URL resolution: `--url` flag (health) → `resolveUrlLoose()` (env `CHRONOLOG_URL` → config file url; token NOT required). No URL anywhere → `AUTH_MISSING`.

---

## Timezone

`entries list` / `stats today` / `stats range` / `goals list`: default tz = `Intl.DateTimeFormat().resolvedOptions().timeZone`; `--tz` overrides. Server requires IANA zone names (validated by luxon `IANAZone`).

---

## Testing

- Tests run on compiled output: `tsc -p tsconfig.test.json` → `node --test` on `dist-test/`. Node 22 cannot resolve `.js`-suffixed ESM imports from `.ts` sources directly — do not attempt source-mode tests.
- `test/client.test.ts` spins up a local `node:http` fake server; tests must not require a real Chronolog instance.
- Config tests set `XDG_CONFIG_HOME` to a temp dir.

---

## Publishing (npm)

- Package is public on npm as `chronolog-cli`. `package.json` must keep: no `private`, `files: ["dist"]`, `license`, `repository`, `keywords`, `author`; `bin` entry `dist/index.js` must retain its `#!/usr/bin/env node` shebang.
- Publish flow: `npm run build` + `npm test` → `npm publish --dry-run` (verify file list = dist artifacts + README + package.json + LICENSE only) → `npm publish`.
- The npm account has 2FA enabled. Publishing from a terminal without interactive OTP requires a **granular access token with "bypass 2FA" enabled**; a token without that setting fails with `EOTP` (or `E403 ... bypass 2fa`). Pass the token via env without echoing it, and never commit it.
- `files: ["dist"]` alone excludes `dist-test/`, `src/`, `tsconfig*.json`, `paseo.json` — do not add an `.npmignore`.
- The portable Agent Skill lives at repository path `skills/chronolog/SKILL.md` for GitHub-based skill installers. It intentionally stays outside the npm tarball; do not add `skills` to `package.json.files` or install it with an npm lifecycle script.

---

## Runtime Dependencies

`dependencies` must stay empty. Build-time only: `typescript`, `@types/node`. No commander/yargs — the self-written parser in `args.ts` is the contract; if a future feature outgrows it, that decision must be revisited explicitly.

---

## Known Server Limits (do not "fix" in CLI)

- `entries create` requires ISO timestamps for `--started-at`/`--stopped-at` (same as `entries update`); no local date+time convenience conversion. `entries delete` only works on stopped entries (running → `409 CONFLICT`).
- `GET /api/entries/today` ignores its `tagId` query param (server-side gap, `today.ts`); `stats today --tag-id` filters correctly.
- `stats range` windows are capped at 92 days server-side; CLI only regex-checks `YYYY-MM-DD`.
- Deleting a tag referenced by a goal → `409 CONFLICT` ("该标签已被目标引用"); deleting a category nulls references and cascades children (no 409).

---

## Common Mistakes

### Mistake: printing progress to stdout

**Cause**: habit from human CLIs.

**Fix**: any human-readable text goes to stderr; stdout is JSON-only, always.
