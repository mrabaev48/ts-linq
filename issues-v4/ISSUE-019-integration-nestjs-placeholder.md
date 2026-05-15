# ISSUE-019: @ts-linq/integration-nestjs Is an Unimplemented Placeholder

## Severity

Low

## Category

- Maintainability
- Documentation Drift

## Location

- `packages/integration-nestjs/src/index.ts`

## Problem

The `@ts-linq/integration-nestjs` package exists in the monorepo with only a placeholder export:

```ts
// NestJS Integration - Coming Soon
export const placeholder = 'integration-nestjs';
```

No NestJS module, injectable service, or provider wrapper is implemented. Despite this, the package occupies a workspace slot, participates in the Turborepo build pipeline, and appears in the public monorepo, implying NestJS integration is available.

## Evidence

`packages/integration-nestjs/src/index.ts`:
```ts
// NestJS Integration - Coming Soon
export const placeholder = 'integration-nestjs';
```

## Why It Matters

- **Documentation drift**: The README and package listing suggest NestJS integration exists. Developers evaluating `ts-linq` for NestJS projects will discover a non-functional stub only after installation.
- **Build resource waste**: The package participates in `turbo run build` and `turbo run typecheck`, consuming CI time for zero output.
- **API stability false signal**: Publishing a package with a version number implies a stable API contract. A stub with no public API cannot fulfill this.

## Recommended Fix

**Option A (preferred)**: Implement the integration:
1. Create a `TsLinqModule` using `@nestjs/common` `DynamicModule` pattern.
2. Wrap `DbContext` in a NestJS `Injectable` service factory.
3. Export `TsLinqModule`, `InjectDbContext` decorator, and related utilities.
4. Follow the pattern of `@nestjs/typeorm` or `@nestjs/sequelize`.

**Option B**: Remove the stub until implementation is ready:
1. Delete `packages/integration-nestjs/`.
2. Remove from `pnpm-workspace.yaml`.
3. Remove from `turbo.json` build pipeline.
4. Add a GitHub issue tracking the planned implementation.

## Acceptance Criteria

- `packages/integration-nestjs/src/index.ts` exports a functional `TsLinqModule` (or the package is removed).
- The `placeholder` export is gone.
- CI does not build or typecheck an empty package.
