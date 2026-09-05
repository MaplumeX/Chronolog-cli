---
name: chronolog
description: Operate a Chronolog time-tracking service through its agent-friendly CLI. Use when the user asks to start or stop a timer, record or edit time entries, inspect time statistics, manage goals, categories, tags, accounts, or Chronolog tokens, including Chinese requests about 计时、时间记录、统计、目标、分类或标签.
license: MIT
compatibility: Requires the `chronolog` executable on PATH and access to a configured Chronolog server. Authentication normally uses CHRONOLOG_URL and CHRONOLOG_TOKEN.
metadata:
  author: Maplume
  version: "1.0"
---

# Use Chronolog safely

Use the `chronolog` CLI as the source of truth. Operational commands return one JSON object on stdout. Read `error.code` before deciding whether to retry or ask the user for help.

## Discover and prepare

1. Run `command -v chronolog` and `chronolog --version` when availability is unknown.
2. Use `chronolog --help`, `chronolog help <command> [subcommand]`, or `chronolog capabilities` to discover current syntax. Do not rely on a memorized command list when the installed CLI can describe itself.
3. If connectivity is uncertain, run `chronolog health`. If identity or authentication is relevant, run `chronolog auth status`.
4. If authentication is missing, ask the user to configure `CHRONOLOG_URL` and `CHRONOLOG_TOKEN` in their environment. Never ask them to paste a token or password into chat.

## Read before writing

- Prefer narrow reads and stable IDs. List or inspect the relevant timer, entries, goals, categories, or tags before changing an existing object.
- Names are resolved only by an exact unique match; prefer returned IDs when a read already provided them.
- For date-sensitive entry, statistics, and goal operations, pass the user's intended IANA timezone explicitly, such as `--tz Asia/Shanghai`. Do not assume the agent host's timezone matches the user.
- Keep stdout and stderr distinct. Parse stdout as JSON for operational commands; stderr is only a human summary. `--help` and `--version` are documented text-output exceptions.

## Mutations and approval

Routine timer actions explicitly requested by the user may proceed. Before any destructive or account-sensitive action, state the exact target and consequence and obtain explicit approval in the current conversation.

This approval boundary includes:

- deleting an entry, goal, tag, token, or account;
- deleting a category, because its children are deleted and referenced entries lose that category;
- changing the account password;
- replacing associations when an update flag has full-replacement semantics.

Prefer a reversible operation such as category archive when it satisfies the user's intent.

Treat credentials as secrets. `tokens create` returns the cleartext token only once: do not repeat it in prose, logs, or summaries. Password and token arguments must never be exposed in the response.

## Recover from failures

- `USAGE`: inspect scoped help and correct the invocation.
- `AUTH_MISSING` or `UNAUTHORIZED`: stop and ask the user to configure or repair authentication without sharing secrets in chat.
- `NOT_FOUND`: refresh the relevant list and use a current ID.
- `CONFLICT` or `OVERLAP`: inspect current state and explain the conflicting object or interval; do not force a destructive workaround.
- `NETWORK` on a read: a bounded retry is safe. `NETWORK` after a write is ambiguous; inspect current state before retrying so a successful request is not duplicated.
- `INTERNAL`, `PARSE`, or `UNKNOWN`: stop, preserve the error code and concise message, and ask for diagnosis rather than guessing.

After a mutation, return a concise result using non-secret IDs and the state that matters to the user's request.
