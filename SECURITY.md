# Security Policy

Claude Clean is a **local** tool. Cleaning must never send file contents anywhere.

## Guarantees

- No telemetry
- No analytics
- No API keys
- No network requests during scan/clean/diff/inspect/git/ci
- Rules and configuration are loaded from disk only

## Threats we defend against

- Path traversal (`..` segments that escape the working directory)
- Symlink traversal (targets and directory entries that are symlinks are refused)
- Enormous files (size cap, default 10 MiB)
- Binary files (NUL bytes and high control-character density)
- Malformed JSON/HTML/Markdown (parse, then refuse unsafe writes)
- Regex denial of service (expression length limits, unbounded-quantifier rejection, match caps)

## Reporting

Open a GitHub issue for vulnerabilities in this repository. Do not attach secrets or private source dumps.
