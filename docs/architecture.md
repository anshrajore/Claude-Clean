# Architecture

```text
Input file
   ↓
Load .claude-clean.yml + rules/*.json
   ↓
Classify file kind (markdown / html / json / text)
   ↓
Build protected ranges (code fences, pre/code)
   ↓
DetectorRegistry (pattern, regex, unicode + context)
   ↓
Filter by confidence and action
   ↓
Build Removal{start,end,replacement=""}
   ↓
Apply from end of document toward the beginning
   ↓
Validate parse, encoding, deletion ratio, hashes
   ↓
Write sidecar / in-place / dry-run
```

JSON never uses regex mutation. The JSON tree is parsed, matching string nodes are edited with `jsonc-parser`, then the result is parsed again.

Markdown and HTML detections still operate on source offsets so headings, lists, tables, links, and emphasis are not rewritten by a serializer.
