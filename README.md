# Claude Clean

Local CLI that detects and **removes** embedded Claude/AI watermark and attribution content from files you own. It is a transformation engine, not a string-replace toy: detections come from versioned rules, offsets are applied from the end of the document, and unrelated content is validated before anything is written.

Claude Clean never uploads files, never calls a network API, and never requires an API key.

## Install

```bash
npm install -g claude-clean
# or from this repo
npm install
npm run build
npm link
```

Requires Node.js 18.18+.

## Usage

```bash
claude-clean README.md
claude-clean clean README.md
claude-clean scan README.md
claude-clean diff README.md
claude-clean inspect README.md
claude-clean clean docs --recursive
claude-clean git
claude-clean git --staged
claude-clean ci
claude-clean --help
claude-clean --version
```

`claude-clean README.md` runs scan → detect → preview → clean and writes `README.cleaned.md` by default.

### Flags

| Flag | Purpose |
| --- | --- |
| `--dry-run` | Detect and plan removals without writing |
| `--backup` | Copy the original to `*.claude-clean.bak` |
| `--overwrite-backup` | Replace an existing backup |
| `--output <file>` | Explicit output path |
| `--in-place` | Overwrite the original file |
| `--recursive` | Walk directories |
| `--include-code` | Allow matches inside fenced code / `<pre>` / `<code>` |
| `--confidence 0.95` | Minimum confidence for removal |
| `--yes` | Also remove preview-threshold matches |
| `--verbose` | Extra diagnostics |
| `--json` | Machine-readable output |
| `--no-color` | Disable ANSI color |

## What it removes

Built-in rules live in [`rules/`](rules/) and are data, not scattered literals in application code. They currently cover common **visible** attribution phrases, HTML comments, frontmatter generator keys, and **long** zero-width character runs that match a signature.

A single mention of the word “Claude” in ordinary prose is not a watermark and is left alone.

Invisible characters are reported by `inspect`. They are deleted only when a rule confirms a watermark signature.

## Confidence

| Score | Behavior |
| --- | --- |
| 99–100% | Removed automatically |
| 90–98% | Removed with `--yes` or confirmation-level flags |
| 70–89% | Preview / report |
| <70% | Report only |

## Configuration

Place `.claude-clean.yml` in the working directory. See [`docs/claude-clean.example.yml`](docs/claude-clean.example.yml).

Custom JSON rules can be added under `rules/custom/` or extra directories listed in config.

## Library API

```ts
import { cleanFile, scanFile } from "claude-clean";

const result = await scanFile("README.md");

if (result.watermarks.length > 0) {
  await cleanFile("README.md");
}
```

## Safety

- Original files are not overwritten unless you pass `--in-place`
- Existing backups are not replaced without `--overwrite-backup`
- Transformations that would delete an unusually large share of the file are aborted
- Markdown code fences are protected unless `--include-code`
- JSON is parsed and edited via a JSON AST, not regex substitution
- Binary files, symlinks, huge files, and path-traversal inputs are rejected

## CI

```bash
claude-clean ci
```

Exit codes: `0` clean, `1` watermark detected, `2` error.

## Documentation

- [Architecture](docs/architecture.md)
- [Rules](docs/rules.md)
- [CLI](docs/cli.md)
- [Security](SECURITY.md)

## License

[MIT](LICENSE)
