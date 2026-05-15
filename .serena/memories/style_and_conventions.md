# Code Style & Conventions

## Formatting (Prettier)
- printWidth: 100
- singleQuote: true
- trailingComma: "none"
- semi: true

## TypeScript / ESLint Rules
- `@typescript-eslint/no-explicit-any`: **error** (no `any` in production code)
- `@typescript-eslint/consistent-type-imports`: warn — use `import type` where possible
- `prefer-const`: warn
- `no-console`: warn (only `console.warn`, `console.error`, `console.log` allowed)
- `complexity`: max 15
- `max-lines-per-function`: 120 (200 in tests)
- `@typescript-eslint/no-unused-vars`: warn, args prefixed `_` are ignored

## Naming Conventions
- PascalCase for classes, interfaces, types, decorators
- camelCase for variables, functions, methods
- Decorators: `@Entity`, `@Column`, `@PrimaryKey`
- Prefixed unused args with `_`

## File Organization
- Source in `src/` within each package
- Tests in `tests/` or `**/*.test.ts` / `**/*.spec.ts`
- Dist output in `dist/`

## Audit Findings
- Write audit findings into `issues-v4/` directory
- Each finding = separate Markdown file
- Use evidence from source, imports, diagnostics, depcruiser, madge, ts-prune
