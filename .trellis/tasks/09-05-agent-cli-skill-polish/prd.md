# Agent-facing CLI polish and Chronolog skill

## Goal

Make `chronolog` self-discoverable and safer for autonomous agents, while shipping a portable Agent Skill from the same repository through the ecosystem's standard GitHub-based installation flow.

## Background

- The published `chronolog-cli@0.1.0` already guarantees one JSON value on stdout, normalized error codes, environment-first authentication, name resolution, and explicit timezone overrides.
- Global `--help` and `--version` are currently parsed as invalid invocations rather than discovery commands (`src/index.ts:16`, `src/args.ts:29`).
- The CLI spec requires surplus positional arguments and unknown flags to fail with `USAGE` (`.trellis/spec/backend/cli-guidelines.md:38`), but command handlers do not consistently enforce those rules; token commands do not call `noUnknownFlags` (`src/commands/tokens.ts:5`).
- File-based credentials are written without an explicit restrictive mode (`src/config.ts:51`).
- The open Agent Skills convention uses `<skill-name>/SKILL.md`. Codex discovers repository skills under `.agents/skills`, while current ecosystem installers can discover a public repository's `skills/*/SKILL.md` and copy it into a host-specific location.
- Installing an npm package does not itself make arbitrary files under global `node_modules` discoverable to agent hosts. The canonical skill will therefore live in this repository but remain outside the npm tarball.
- OpenAI's agent-friendly CLI guidance treats predictable JSON for operational data and conventional `--help` discoverability as separate requirements. Mature general-purpose CLIs similarly keep help/version human-readable and expose structured data through an explicit JSON mode. The proposed Chronolog contract therefore distinguishes discovery invocations from operational commands instead of forcing one representation onto both.

## Requirements

### R1 — Machine-discoverable CLI surface

- Provide conventional human-readable global version discovery, plus a structured form for callers that require JSON.
- Provide conventional human-readable root and command-scoped help, plus a structured JSON form, all derived from a single command metadata source rather than duplicating command definitions across handlers and help text.
- Provide a machine-readable capability manifest that describes commands, arguments, flags, authentication requirements, mutation/destructive classification, and representative error behavior.
- Preserve the existing JSON and exit-code contract for operational commands. Explicit discovery invocations (`--help`, `help`, `--version`) may use their documented human-readable representation; their structured variants remain single JSON objects.

### R2 — Strict argument validation

- Every command must reject unknown flags with `USAGE`.
- Every command must reject surplus positional arguments with `USAGE`.
- Boolean flags must not silently consume arbitrary following positionals as their values.
- Existing supported forms (`--flag value`, `--flag=value`, repeated `--tag`) must remain compatible.

### R3 — Credential file safety

- File-based credentials must be created with owner-only permissions on supported POSIX systems.
- Existing environment-variable precedence and XDG path behavior must remain unchanged.
- The task will not add an OS keychain or change the accepted plaintext-config trade-off.

### R4 — Portable Chronolog Agent Skill

- Add one instruction-only skill at `skills/chronolog/SKILL.md`, conforming to the open Agent Skills format.
- The skill must teach agents to check connectivity/auth, pass explicit timezones for date-sensitive operations, inspect state before mutation, obtain confirmation before destructive operations, parse stdout JSON, and recover conservatively from ambiguous network failures.
- Detailed command syntax must come from the CLI's help/capability surface; the skill must not duplicate the full README command reference.
- Document installation from the GitHub repository for at least Codex and Claude Code.
- Keep `package.json.files` limited to runtime CLI artifacts; do not copy the skill through npm `postinstall` and do not write into agent configuration directories during npm installation.

### R5 — Documentation and compatibility

- Update README usage and installation guidance for both the CLI and optional skill.
- Update the executable CLI spec whenever an established contract changes.
- Preserve existing commands and server API request shapes.

## Acceptance Criteria

- [x] `chronolog --version` succeeds with concise conventional text, while a documented structured version invocation returns one JSON object.
- [x] `chronolog --help`, `chronolog help`, and command-scoped help expose concise, accurate human-readable command documentation without authentication or network access.
- [x] A documented JSON help mode exposes the same command metadata as a single parseable JSON object.
- [x] `chronolog capabilities` returns a single parseable JSON object covering every public command.
- [x] Unknown flags, surplus positionals, and invalid boolean-flag values return `USAGE` and exit non-zero across all command groups.
- [x] Existing valid invocations continue to parse and generate the same API requests.
- [x] Newly written config files are owner-readable/writable only on POSIX systems, with regression coverage.
- [x] `skills/chronolog/SKILL.md` passes structural validation and remains instruction-only.
- [x] README shows separate CLI and skill installation, including `gh skill install` examples for Codex and Claude Code.
- [x] `npm pack --dry-run` does not contain `skills/` and still contains the executable `dist` artifacts.
- [x] Type checking, unit tests, build, CLI smoke checks, and package dry-run pass.

## Out of Scope

- MCP server or remote connector implementation.
- Publishing a ChatGPT/Codex or Claude Code plugin marketplace entry.
- Automatic skill installation from npm lifecycle scripts.
- Batch commands, idempotency-key server support, OS keychain integration, or new Chronolog server endpoints.
- Publishing a new npm version or marketplace listing as part of this implementation task.
- Multi-model Skill benchmark/evaluation runs; this instruction-only Skill will receive structural and contract-focused tests in this task.

## Product Decisions

- The user approved the hybrid output contract on 2026-09-05: human-readable `--help` / `--version`, explicit structured help/version forms, and JSON-only operational command output.
- The portable Skill is distributed from this GitHub repository using ecosystem Skill installers, not through the npm tarball.
