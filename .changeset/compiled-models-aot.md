---
"@ts-linq/metadata": minor
"@ts-linq/orm": minor
"@ts-linq/cli": minor
---

feat(P2-44): implement compiled models / AOT optimization

- `@ts-linq/metadata`: adds `CompiledModel` interface and `loadCompiledModel()` hydration service
- `@ts-linq/orm`: DbContext pre-populates MetadataRegistry from `compiledModel` option, skipping reflective decorator scan
- `@ts-linq/cli`: new `dbcontext optimize` command generates `.generated.ts` AOT snapshots; `--check` flag for CI drift detection
