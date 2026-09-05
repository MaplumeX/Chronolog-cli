# CLI discovery output conventions

Research date: 2026-09-05

## Question

Should `chronolog --help` and `chronolog --version` preserve the CLI's JSON-only stdout contract, or use conventional human-readable output?

## Evidence

- GNU CLI conventions treat `--help` and `--version` as standard successful discovery options. `--version` prints a simple program/version line to stdout intended to be easy for programs to parse; `--help` prints usage text.
- GitHub CLI emits human-oriented plain text by default and uses an explicit `--json` option where structured output is supported.
- `kubectl` emits human-readable text by default and requires an explicit `-o json` for stable structured automation output. Its scripting guidance tells callers to request a machine-oriented output form explicitly.
- AWS CLI exposes selectable output formats rather than making help text itself a JSON document.

## Interpretation for Chronolog

Chronolog differs from those general-purpose CLIs because its operational commands are explicitly agent-first and already have a stable JSON contract. That contract remains valuable and should not be weakened.

Discovery commands serve a different purpose from operational commands. A hybrid contract best fits both conventions:

- `chronolog --help`, `chronolog help`, and command-scoped help: concise human-readable text on stdout, exit 0.
- `chronolog --version`: `chronolog <version>` text on stdout, exit 0.
- `chronolog capabilities` (and optionally `help --json`): the authoritative machine-readable JSON command manifest.
- All operational success and failure responses: retain the existing JSON stdout contract.

Avoid TTY-dependent implicit format switching. Explicit commands/formats remain deterministic in terminals, pipes, tests, and agent shells.

## Sources

- GNU Coding Standards, command-line interfaces and `--version`: https://www.gnu.org/prep/standards/standards.html
- GitHub CLI formatting: https://cli.github.com/manual/gh_help_formatting
- kubectl output options and scripting conventions: https://kubernetes.io/docs/reference/kubectl/ and https://kubernetes.io/docs/reference/kubectl/conventions/
- AWS CLI output formats: https://docs.aws.amazon.com/cli/latest/userguide/cli-usage-output-format.html

