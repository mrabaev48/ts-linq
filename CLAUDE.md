# Claude Code Instructions for ts-linq

## Architecture Tooling

Before making architectural claims, use the available project tools.

Run:

```bash

pnpm typecheck

pnpm arch:deps

pnpm arch:cycles

pnpm arch:dead
```

Use tool output as evidence.

Serena MCP

Use Serena MCP for semantic code navigation:

* find symbols
* inspect references
* inspect implementations
* inspect public API exposure
* inspect cross-package dependencies

Rules

Do not refactor production code during audit unless explicitly requested.

Write audit findings into:

issues-v4/


Each finding must be a separate Markdown file.

Use evidence from:

* source files
* imports
* package boundaries
* TypeScript diagnostics
* dependency-cruiser output
* madge output
* ts-prune output

Prefer concrete architecture issues over style-only findings.

---