# Task Completion Checklist

After completing any coding task in ts-linq:

1. **Type check**: `pnpm typecheck`
2. **Lint**: `pnpm lint`
3. **Format**: `pnpm format`
4. **Unit tests**: `pnpm test:unit`
5. **Architecture check** (for structural changes): `pnpm arch:audit`

For audit/analysis tasks:
- Write findings to `issues-v4/<finding-name>.md`
- Include evidence: source references, tool output, package boundaries
- Do NOT refactor production code during audit unless explicitly requested
