# Contributing

## Development

```bash
npm install
npm run build
npm test
npm run lint
```

## Rules

Detection signatures belong in `rules/<provider>/*.json`, not in TypeScript `replace()` calls. Validate new rules with fixtures that prove:

1. The watermark is detected
2. The watermark is removed
3. Surrounding content is byte-for-byte unchanged outside the removal ranges

## Style

- TypeScript strict mode
- ESLint + Prettier
- Keep the CLI fully offline

## Pull requests

Include tests for new file types or new rule families.
