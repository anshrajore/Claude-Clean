# Rules

Rules are versioned JSON documents.

```json
{
  "id": "claude-watermark-example",
  "provider": "claude",
  "type": "watermark",
  "match": {
    "type": "regex",
    "expression": "Generated (?:by|with) Claude",
    "flags": "i"
  },
  "confidence": 0.99,
  "action": "remove",
  "expandToLine": true
}
```

`match.type` may be `literal`, `regex`, or `unicode-sequence`.

Place files in:

```text
rules/claude/
rules/generic/
rules/custom/
```

Enable providers in `.claude-clean.yml`:

```yaml
rules:
  enabled:
    - claude
    - generic
    - custom
```
