# CLI Guidelines

> Conventions for the `chronolog` CLI (this repo). Applies to all code under `src/` and `test/`.

---

## Overview

The CLI is an agent-facing JSON client for the Chronolog server (`../Chronolog`). Contracts below are executable rules — changing any of them requires updating tests and this spec together.

---

## Output Contract (CRITICAL)

- Success: single JSON object to stdout via `JSON.stringify(result)`, exit code 0. No extra prints, no pretty tables, no colors on stdout.
- Failure: `{"error":{"code":"...","message":"..."}}` to stdout, one-line human summary to stderr, exit code 1.
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

Config file shape: `{ "url": string, "token": string }`. Token stored in plaintext (accepted tradeoff for self-hosted personal use; do not add OS keychain).

---

## Argv Parsing Contract (`src/args.ts`)

- First non-flag segments = command path (e.g. `timer start`); extra positional segments beyond the command signature → `USAGE`.
- `--flag value` and `--flag=value` both valid; bare `--flag` = boolean `true`; repeated flags aggregate into a string array.
- Unknown flag → `USAGE`.

---

## API Client Rules (`src/client.ts`)

- Always send `Authorization: Bearer <token>`; 30s timeout via `AbortSignal.timeout` (TimeoutError → `NETWORK`).
- Non-2xx: parse server body `{error:{code,message}}` and rethrow normalized. Non-JSON non-2xx body → `UNKNOWN` (not `PARSE` — `PARSE` is reserved for non-JSON 2xx success bodies).
- Server API base: `<url>/api/...`. Field names must match server zod schemas exactly: `categoryId`, `tagIds`, `description`, `startedAt`, `stoppedAt`, `tz`, `date`, `tagId`, `name`.

---

## Name Resolution (`src/resolve.ts`)

`--category` / `--tag` values: exact unique name match (via `GET /api/categories|tags`) → use its id; otherwise pass value through as-is (server validates ownership and returns `NOT_FOUND`). Do not pre-validate locally.

---

## Timezone

`entries list` / `stats today`: default tz = `Intl.DateTimeFormat().resolvedOptions().timeZone`; `--tz` overrides. Server requires IANA zone names (validated by luxon `IANAZone`).

---

## Testing

- Tests run on compiled output: `tsc -p tsconfig.test.json` → `node --test` on `dist-test/`. Node 22 cannot resolve `.js`-suffixed ESM imports from `.ts` sources directly — do not attempt source-mode tests.
- `test/client.test.ts` spins up a local `node:http` fake server; tests must not require a real Chronolog instance.
- Config tests set `XDG_CONFIG_HOME` to a temp dir.

---

## Runtime Dependencies

`dependencies` must stay empty. Build-time only: `typescript`, `@types/node`. No commander/yargs — the self-written parser in `args.ts` is the contract; if a future feature outgrows it, that decision must be revisited explicitly.

---

## Known Server Limits (do not "fix" in CLI)

- No `POST /api/entries`, no `DELETE /api/entries/:id` — entries come only from `timer start/stop`. `entries update` is full-field PATCH.
- `GET /api/entries/today` ignores its `tagId` query param (server-side gap, `today.ts`); `stats today --tag-id` filters correctly.

---

## Common Mistakes

### Mistake: printing progress to stdout

**Cause**: habit from human CLIs.

**Fix**: any human-readable text goes to stderr; stdout is JSON-only, always.