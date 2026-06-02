# refactor/phase-x/types/task-2 — OrmError hierarchy (COMPLETED)

Branch: `refactor/types-error-hierarchy`. Status: completed.

## What was built (in `packages/types/src/errors.ts`)
Single abstract root + concrete tree. `abstract class OrmError extends Error`:
- `abstract readonly code: string` (subclasses narrow to a literal)
- `declare readonly cause?: unknown` (self-declared so consumers see it regardless of their `lib`; native ES2022 Error cause set in ctor)
- `readonly details?: Readonly<Record<string, unknown>>`
- `protected constructor(message, opts?: OrmErrorOptions)` → `super(message, opts?.cause !== undefined ? { cause } : undefined)`, sets `this.name = new.target.name`, `this.details`.

`OrmErrorOptions = { readonly cause?: unknown; readonly details?: Record<string, unknown> }`.

`OrmErrorCode` = `as const` object + derived union (NOT const enum — bundler/isolatedModules safe).

### Class tree → code
- DatabaseError(message, cause?: Error) → 'DATABASE_ERROR' (code typed `string` so subclasses can override; has `declare readonly cause?: Error`)
  - OptimisticConcurrencyError(message) → 'OPTIMISTIC_CONCURRENCY_CONFLICT'
  - UniqueConstraintError(message, table?, column?) → 'UNIQUE_CONSTRAINT_VIOLATION'
  - ForeignKeyConstraintError(message, table?, constraint?) → 'FOREIGN_KEY_CONSTRAINT_VIOLATION'
- ValidationError(message) → 'VALIDATION_ERROR' (was extends Error; now OrmError)
- TemporalNotSupportedError(message) → 'TEMPORAL_NOT_SUPPORTED' (was extends Error; now OrmError)
- UnsupportedOperationError(message, opts?) → 'UNSUPPORTED_OPERATION'  [NEW]
- MetadataError(message, opts?) → 'METADATA_ERROR'  [NEW]
- DecoratorUsageError(message, opts?) → 'DECORATOR_USAGE_ERROR'  [NEW]
- BatchConfigurationError(message, opts?) → 'BATCH_CONFIGURATION_ERROR'  [NEW]
- InvalidIncludeError(message, opts?) → 'INVALID_INCLUDE'  [NEW]
- OperationAbortedError(message, opts?) → 'OPERATION_ABORTED'  [NEW]

## Key technique: subclass code override WITHOUT casts
`code` is an abstract field; each subclass uses a field initializer `public (override) readonly code = OrmErrorCode.X`. Under `useDefineForClassFields:false` (target ES2020), the subclass initializer runs after `super()` and overwrites the parent's value at runtime. No `as`/cast needed.

## tsconfig changes (ES2022 Error.cause)
`super(message, { cause })` needs the 2-arg Error ctor + `ErrorOptions` (ES2022). Build configs are STANDALONE (don't extend shared base), so `lib` had to be bumped in 3 places:
- `packages/typescript-config/base.json`: lib += "ES2022.Error" (covers all typecheck via node.json)
- `packages/types/tsconfig.build.json`: lib += "ES2022.Error" (standalone build config)
- `packages/jest-config/index.js`: ts-jest tsconfig lib `['ES2021','ES2022.Error','DOM']` (ts-jest compiles errors.ts from src)
Self-declaring `cause` on OrmError means DOWNSTREAM consumers do NOT need the lib (only where errors.ts itself is compiled).

## AST alignment (`packages/ast/src/errors.ts`)
`AstSqlGenerationError` now `extends OrmError`; ctor `(code, message, details = {})` → `super(message, { details })`, then assigns code/details. `code`/`details` use `override`. CRITICAL: `AstSqlGenerationErrorDetails` had to change from `interface` to `type` alias — interfaces aren't assignable to `Record<string, unknown>` (open for augmentation), type aliases are (implicit index signature).

## Backward compatibility
All existing constructor signatures + class names + `this.name` strings unchanged. `instanceof DatabaseError/ValidationError/etc.` all still work; everything is now also `instanceof OrmError`. Verified by `packages/types/src/__tests__/errors.test.ts` (unit + type-level) and updated `packages/types/tests/type-exports.test.ts` (runtime export manifest).

## For core/task-6 (downstream, depends on this)
The 6 new categories map to the ~21 bare `throw new Error` in `packages/core/src`:
- MetadataError: batch/* missing PK/metadata (BatchDelete/Update/Upsert, BatchOperations.getEntityMetadata)
- BatchConfigurationError: BatchOperations batch-size, BatchInsert no insertable columns
- DecoratorUsageError: decorators/CachePolicy.ts, decorators/ValidIf.ts (7 TS5 stage-3 throws)
- UnsupportedOperationError: DatabaseProvider.nextSequenceValue (~line 828)
- OperationAbortedError: DatabaseProvider.streamRows abort checks (~282,289)
- InvalidIncludeError: EntityLoader.validateIncludes (~320); also ValidationError for IndexOptionsBuilder (72,75)
NOTE: query has its own `IncludeResolutionError` (packages/query/src/errors.ts) — separate, NOT re-rooted (future query task / tech-debt).

## Deferred / tech debt
- `Result<T,E>` (already in types/results.ts) NOT adopted on boundaries this task — throwing hierarchy is sufficient; remains opt-in.
- `IncludeResolutionError` (@ts-linq/query) re-root deferred.
- errors subpath export deferred (task-1 tech debt).

## Validation outcomes
typecheck 32/32 ✓, build 32/32 ✓, lint 0 errors ✓, test:unit 2961 passed (one flaky SIGSEGV in transformer IdentifierVisitor — passes in isolation, unrelated), arch:deps ✓, arch:cycles ✓, arch:dead clean. integration/e2e NOT run (need live DBs, hang).

## Changesets
`@ts-linq/types` minor, `@ts-linq/ast` patch.
