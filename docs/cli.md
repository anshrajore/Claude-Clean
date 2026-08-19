# CLI

```bash
claude-clean <file>
claude-clean clean <file>
claude-clean scan <file>
claude-clean diff <file>
claude-clean inspect <file>
claude-clean clean <directory> --recursive
claude-clean git [--staged]
claude-clean ci [path]
```

Default output for `README.md` is `README.cleaned.md`.

Backup path: `README.md.claude-clean.bak`.

`diff` never writes files. `ci` never writes files. Exit codes for `ci`: 0 clean, 1 watermark found, 2 error.
