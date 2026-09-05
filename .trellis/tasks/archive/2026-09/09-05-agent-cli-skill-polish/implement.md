# Implementation Plan: Agent-facing CLI polish and Chronolog skill

## 1. Command metadata and discovery

- [x] Add the typed authoritative command catalog covering every current command.
- [x] Add package-version resolution from the owning `package.json`.
- [x] Implement deterministic root/scoped text help.
- [x] Implement JSON help, JSON version, and full `capabilities` output.
- [x] Route global and command-scoped discovery before auth/network dispatch.

## 2. Strict parsing and validation

- [x] Make flag parsing catalog-aware so boolean flags never consume values.
- [x] Centralize generic command-shape validation.
- [x] Reject unknown flags, missing values, invalid boolean values, repeated scalar flags, and surplus/missing positionals.
- [x] Preserve `--flag value`, `--flag=value`, and repeatable `--tag` behavior.
- [x] Add parser, catalog coverage, and CLI-level regression tests.

## 3. Credential hardening

- [x] Write and enforce config mode `0o600` on POSIX-compatible platforms.
- [x] Test new-file and existing-file permission behavior without changing XDG/auth precedence.

## 4. Portable Skill and docs

- [x] Add `skills/chronolog/SKILL.md` as a concise instruction-only open Agent Skill.
- [x] Add static validation for frontmatter and required safety/workflow contracts.
- [x] Update README with discovery commands, hybrid output rules, and separate Codex/Claude Code Skill installation.
- [x] Update `.trellis/spec/backend/cli-guidelines.md` with the new executable contracts.

## 5. Verification

- [x] Run `npm run typecheck`.
- [x] Run `npm test`.
- [x] Run `npm run build`.
- [x] Smoke-test text help/version and JSON help/version/capabilities from compiled output.
- [x] Run `npm pack --dry-run` and verify `skills/` is excluded while required `dist/` artifacts are present.
- [x] Review the diff for catalog/dispatch drift, secret exposure, and accidental npm lifecycle changes.

## Risk and rollback points

- Parser changes are the highest compatibility risk; complete parser and existing command tests before modifying documentation.
- The command catalog must be exhaustively cross-checked against dispatch handlers.
- Do not change server request shapes while consolidating argument validation.
- Do not publish to npm in this task.
