# Task Completion Checklist

After completing any coding task in ts-linq:

1. **Type check**: `pnpm typecheck`
2. **Lint**: `pnpm lint`
3. **Format**: `pnpm format`
4. **Unit tests**: `pnpm test:unit`
5. **Architecture check** (for structural changes): `pnpm arch:audit`

For audit/analysis tasks:
- Write findings to `project-documents/issues/issues-vN/<finding-name>.md` (N = current audit version)
- NOTE: CLAUDE.md says `issues-v4/` at repo root, but actual location is `project-documents/issues/issues-vN/`
- Include evidence: source references, tool output, package boundaries
- Do NOT refactor production code during audit unless explicitly requested

## EF Core Parity Tasks
- Dev plan files: `project-documents/tasks/dev-plans/P0-01-*.md` through `P2-48-*.md`
- 48 total tasks across 3 priority tiers (P0 = foundation, P1 = core features, P2 = advanced)
