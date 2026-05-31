# P1-30: Value Generators and Sentinel

**Status:** ✅ done (feat/p1-28-track-graph-detect-changes branch)

## Summary
Implements pluggable client-side value generation and sentinel-based "not-set" detection, mirroring EF Core 8's `ValueGeneratedOnAdd` / `HasValueGenerator` / `HasSentinel` API.

## New symbols

### `@ts-linq/types` (`packages/types/src/index.ts`)
- `enum ValueGeneratedPolicy { Never, OnAdd, OnUpdate, OnAddOrUpdate }`
- `interface ValueGenerator<T> { next(ctx: ValueGeneratorContext): T }`
- `type ValueGeneratorClass<T> = new () => ValueGenerator<T>`
- `interface ValueGeneratorContext { entityClass: Function; propertyName: string }`
- `ColumnMetadata` extended with: `valueGeneratedPolicy?`, `sentinel?`, `valueGeneratorClass?`

### `@ts-linq/metadata` (`packages/metadata/src/index.ts`)
- Re-exports all four new types from `@ts-linq/types`

### `@ts-linq/orm`
- **`PropertyBuilder<TValue>`** (`packages/orm/src/builders/PropertyBuilder.ts`):
  - `valueGeneratedOnAdd()`, `valueGeneratedOnUpdate()`, `valueGeneratedOnAddOrUpdate()`, `valueGeneratedNever()`
  - `hasValueGenerator<T>(cls: ValueGeneratorClass<T>): this`
  - `hasSentinel(value: TValue): this`
- **Built-in generators** (`packages/orm/src/valueGenerators/`):
  - `UlidValueGenerator` — Crockford Base32 ULID, no external deps (uses `crypto.randomBytes`)
  - `UuidV7ValueGenerator` — Time-ordered UUID v7, no external deps
  - `UtcNowValueGenerator` — returns `new Date()`

## Integration points

### `DbContext.prefillDefaults()` (`packages/orm/src/DbContext.ts`, ~line 812)
Extended to run for both `added` and `modified` states. Logic per column:
1. If no `valueGeneratedPolicy` → legacy defaultValue fill for `added` only
2. `Never` → skip
3. `OnAdd` + state `modified` → skip; `OnUpdate` + state `added` → skip
4. If `valueGeneratorClass` present → check sentinel: if `currentValue === sentinel` (or `undefined` when no sentinel) → invoke generator and assign
5. DB-side (no `valueGeneratorClass`) → skip column, IDENTITY/SERIAL handles it

### `BatchGrouper.calcParamsPerRow()` (`packages/orm/src/save-changes/batch-grouper.ts`, ~line 84)
UPDATE filter now also excludes `valueGeneratedPolicy === 'Never'` columns. INSERT filter handles distinction between DB-side (no `valueGeneratorClass`, exclude when value null/undefined) vs client-side (value already filled by prefillDefaults, include).

## Precedence rule
1. `Never` → user value always wins
2. Policy mismatch (OnAdd during UPDATE, OnUpdate during INSERT) → user value
3. `valueGeneratorClass` set + (value === sentinel or value === undefined) → generator runs
4. `valueGeneratorClass` set + user value present → preserve user value
5. No `valueGeneratorClass` → DB-side path (omit from INSERT)

## Architecture notes
- `ValueGeneratedPolicy` + interfaces live in `@ts-linq/types` (zero-dependency package) — NOT in `@ts-linq/metadata`, to avoid `types` importing `metadata`
- Concrete generators are Infrastructure layer in `@ts-linq/orm/valueGenerators/`
- Existing `isGenerated: boolean` preserved for backward compatibility

## Tests
- `packages/orm/tests/property-builder-value-generators.test.ts` — 30 unit tests covering all methods, all three generators, sentinel logic
- `packages/types/tests/type-exports.test.ts` — updated expected exports list + ValueGeneratedPolicy enum test

## Follow-up
- P1-21 (Sequences/HiLo) is now unblocked — `HiLoValueGenerator` will implement `ValueGenerator<number>`
- Integration test against real dialect (DB-side IDENTITY path) deferred to P1-21
