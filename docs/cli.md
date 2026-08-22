# CLI

```bash
claude-clean <file>
claude-clean clean <file>
claude-clean scan <file>
claude-clean diff <file>
claude-clean inspect <file>
claude-clean report [path]
claude-clean clean <directory> --recursive
claude-clean git [--staged]
claude-clean ci [path]
```

Default output for `README.md` is `README.cleaned.md`.

Backup path: `README.md.claude-clean.bak`.

`diff` never writes files. `ci` never writes files. Exit codes for `ci`: 0 clean, 1 watermark found, 2 error.

## Advanced flags

- `--profile strict` only removes the highest-confidence signatures.
- `--profile balanced` uses the configured automatic removal threshold.
- `--profile aggressive` allows preview-threshold signatures when paired with cleanup workflows.
- `--ignore <pattern>` skips matching files or directories during recursive scans.
- `--report-format markdown|json|sarif` controls `report` output.

Scan and clean commands include token-impact estimates so you can measure recovered LLM context before content leaves your machine.
