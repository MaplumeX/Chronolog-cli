# Design: Agent-facing CLI polish and Chronolog skill

## 1. Boundaries

The change has four cooperating parts:

1. A declarative command catalog describing every public command and its arguments.
2. CLI parsing/dispatch that uses the catalog for discovery and strict validation.
3. Credential configuration hardening.
4. A portable instruction-only Agent Skill and updated installation documentation.

The Chronolog server API and all existing request/response bodies remain unchanged.

## 2. Command Catalog

Add one internal catalog module under `src/` as the authoritative source for:

- root command and subcommand names;
- summary and usage text;
- positional argument cardinality;
- flag names and kinds (`string`, `boolean`, `repeatable-string`);
- required flags;
- authentication requirement;
- operation class (`read`, `write`, `destructive`, `local`);
- representative error codes.

Handlers remain authoritative for business-specific value validation and API request construction. The catalog owns only generic CLI shape and discovery metadata. Help text and the capability manifest are rendered from this catalog so they cannot drift independently.

## 3. Discovery Contract

### Human-readable invocations

- `chronolog --help` and `chronolog help` render root help text.
- `chronolog <root> --help`, `chronolog <root> <sub> --help`, and `chronolog help <root> [sub]` render scoped help text.
- `chronolog --version` renders `chronolog <version>`.

These invocations exit 0, require no auth, perform no network calls, and are the documented exceptions to JSON stdout.

### Structured invocations

- `chronolog help [root] [sub] --json` returns one JSON object containing the selected catalog fragment.
- `chronolog version --json` returns `{ "name": "chronolog", "version": "..." }`.
- `chronolog capabilities` returns one JSON object containing version, output-contract metadata, and the complete public command catalog.

The installed version is read from the nearest owning `package.json` whose package name is `chronolog-cli`, walking upward from the compiled module location. This keeps `package.json` authoritative while working from `dist/`, the compiled test tree, and a global npm installation.

## 4. Parsing and Validation

Discovery invocations are recognized before authenticated command dispatch.

For operational commands, parsing uses the selected catalog entry to distinguish boolean flags from value-taking flags. This prevents a boolean such as `--today` from consuming the next positional token as a value.

Generic validation runs centrally before handlers:

- unknown command/subcommand;
- unknown flags;
- missing flag values;
- boolean flags supplied with a value;
- non-repeatable flags repeated;
- missing or surplus positional arguments;
- missing required flags.

Existing handler checks remain temporarily acceptable when they provide more specific domain messages, but central validation must cover all commands, including token commands. Supported `--flag value`, `--flag=value`, and repeated `--tag` syntax remains intact.

## 5. Output and Error Compatibility

- Operational success remains a single JSON object on stdout with exit code 0.
- Operational failure remains an error JSON object on stdout, a one-line stderr summary, and exit code 1.
- Discovery lookup failures (unknown help path, invalid discovery flag) use the existing `USAGE` error envelope.
- No colors or terminal-width-dependent formatting are introduced. Human help is deterministic plain text so agents can still read it reliably.

## 6. Credential File Permissions

Create the config directory recursively, then write the config file with mode `0o600`. After writing, enforce `0o600` on POSIX so an existing permissive file is also corrected. Permission hardening errors must not be silently swallowed; they surface as normal CLI failures. Windows keeps platform-supported behavior without asserting POSIX mode bits in tests.

No keychain, encryption, or credential migration is introduced.

## 7. Agent Skill

Add `skills/chronolog/SKILL.md` with valid open Agent Skills frontmatter:

- `name: chronolog`;
- a trigger-oriented `description` covering time tracking, timers, entries, statistics, goals, categories, and tags;
- `compatibility` noting that the `chronolog` executable must be on PATH and authentication must be configured.

The body stays concise and workflow-oriented:

1. Check `command -v chronolog`, version, health/auth status, and capabilities when necessary.
2. Prefer narrow reads and stable IDs before writes.
3. Pass an explicit IANA timezone for date-sensitive operations.
4. Parse stdout JSON and branch on `error.code`.
5. Require explicit user approval for destructive actions.
6. On an ambiguous `NETWORK` result after a write, inspect state before retrying.

The Skill obtains exact syntax from `chronolog help ...` / `chronolog capabilities`; it does not mirror the full command table. It contains no scripts and no pre-approved shell-tool declaration.

## 8. Distribution and Documentation

Keep the canonical Skill at visible repository path `skills/chronolog/SKILL.md`, which repository-based installers can discover. Do not add `skills` to `package.json.files` and do not add an npm lifecycle installer.

README documents two independent installations:

- `npm i -g chronolog-cli` for the executable;
- `gh skill install MaplumeX/Chronolog-cli chronolog --agent <host> --scope user` for the optional Skill, with Codex and Claude Code examples.

## 9. Testing

- Catalog coverage test: every dispatchable command has catalog metadata and vice versa.
- Parser tests: valid legacy syntax, boolean handling, missing values, repeats, unknown flags, and surplus positionals.
- Discovery tests: root/scoped human help, JSON help, capabilities, human version, and JSON version without auth/network.
- Config test: POSIX file mode is `0o600` after initial creation and overwrite.
- Skill test: required frontmatter, expected safety guidance, and absence from `npm pack --dry-run`.
- Existing command/request tests remain the compatibility baseline.

## 10. Rollback

The change is additive except for stricter rejection of previously ignored invalid arguments. Rollback consists of reverting the catalog-driven parser/discovery modules and permission hardening; server state and stored config shape require no migration.
