# metadata/task-1: MetadataSource / MetadataSink read-port

**Status:** completed. Branch `refactor/metadata-source-read-port`.

## What was done
Introduced two ports (Ports-and-Adapters + ISP) so consumers depend on an abstraction
instead of the `MetadataStorage` global singleton or the concrete `MetadataRegistry`.

- **`MetadataSource`** (read, 5 methods): `getEntity(target: Function)`, `getEntities()`,
  `getValidationRules(target)`, `getOwnedEntities(owner)`, `getStoredProcedureMapping(target)`.
- **`MetadataSink`** (write, full registration surface): `addEntity/addColumn/addPrimaryKey/
  addRelationship/addIndex/addValidationRule`, all `mergeFluent*` + `setFluent*`,
  `addComplexProperty/addOwnedEntity/addShadowProperty`, `setHierarchyMetadata/
  setHierarchyRoot/setSeedData/setCheckConstraints/setEntityComment/setStoredProcedureMapping`,
  `clear`.
- Signatures mirror `MetadataRegistry` exactly (`target: Function`, NOT `EntityCtor`) →
  zero behaviour/call-site change; method bivariance lets `implements` pass with no body edits.

## Placement decision (justified via arch:deps)
Both ports live in **`@ts-linq/types`** -> `packages/types/src/metadata.ts` (zero-dep package),
exported automatically through the `export * from './metadata'` barrel. This avoids forcing a
`core -> metadata` type dependency. `@ts-linq/metadata/src/index.ts` ALSO re-exports
`MetadataSource`/`MetadataSink` (type-only) from `@ts-linq/types` for ergonomics.

New intra-`types` DAG edge: `metadata.ts -> stored-procedure.ts` (for
`EntityStoredProcedureMapping`). Acyclic — `stored-procedure.ts` depends only on `sql.ts`.

## Key files
- `packages/types/src/metadata.ts` — interface defs + `import type { EntityStoredProcedureMapping } from './stored-procedure'`.
- `packages/metadata/src/MetadataRegistry.ts:36` — `export class MetadataRegistry implements MetadataSource, MetadataSink`.
- `packages/metadata/src/index.ts` — re-export of both ports.
- `packages/metadata/src/MetadataStorage.ts` — TSDoc-only note: "default-source provider only" (no code change; static API + decorator registration fully backward compatible).
- `packages/metadata/tests/MetadataSource.test.ts` — type-level (`satisfies`) + unit + contract (fake source) + regression (decorator/static). ts-jest type-checks, so type-level asserts are enforced at jest run; moduleNameMapper points `@ts-linq/types` at src.

## Validation (all green)
typecheck 32/32, lint 0 errors, build 32/32, unit 2982, integration 464(+2 skip), e2e 290,
arch:deps (832 modules, 0 violations), arch:cycles clean, arch:dead clean.

## Changeset
`.changeset/metadata-source-read-port.md` — minor for `@ts-linq/types` and `@ts-linq/metadata`.

## Follow-up / link
`core/task-2` = the dependent consumer: inject `MetadataSource` into `EntityLoader`,
`RelationshipLoader`, `LazyLoadingProxy` (constructor DI), replace direct
`MetadataStorage.getEntity(...)` in `packages/core/src/loading/*`, wire
`options.registry ?? MetadataStorage.getInstance()` at `DbContext`. Port shape already
matches its needs (`getEntity`, `getEntities`).
