---
name: p1-32-backing-fields
description: P1-32 Backing fields and property access mode — PropertyAccessor abstraction, hasField/usePropertyAccessMode API
metadata:
  type: project
---

P1-32 is implemented and merged via PR #129.

**New public API:**
- `PropertyAccessMode` enum in `@ts-linq/metadata` — `Property | Field | FieldDuringConstruction`
- `PropertyAccessor<T>` interface in `@ts-linq/metadata` — `get(entity): T`, `set(entity, v): void`, `constructionSet(entity, v): void`
- `createPropertyAccessor(propName, fieldName, mode)` factory
- `defaultPropertyAccessor(propName)` — Property-mode default (no overhead)
- `PropertyBuilder.hasField(fieldName)` — mirrors EF Core HasField
- `PropertyBuilder.usePropertyAccessMode(mode)` — mirrors EF Core UsePropertyAccessMode
- `EntityTypeBuilder.usePropertyAccessMode(mode)` — entity-level default

**Key implementation decisions:**
- Generated accessor closures at model-build time (Option A from task doc) — zero per-call branching
- Default when only `hasField()` given: `FieldDuringConstruction` (bypass setter during hydration, use setter for mutations)
- `_underscored` convention assumed when no explicit fieldName is given
- `ColumnMetadata` extended with `fieldName?`, `accessMode?`, `accessor?: unknown` (opaque at types layer)
- `RowMaterializer.materializeEntityWith` now calls `accessor.constructionSet` instead of `entity[propName] = value`
- `ChangeTracker.hasChanged` reads via `accessor.get`; `cloneObject` reads/writes via accessor for comparer.snapshot
- Backward compatible: entities without explicit config use `defaultPropertyAccessor` (same as before)

**Why:** `accessor?: unknown` in `@ts-linq/types` (not `PropertyAccessor`) to avoid a cross-package type dependency from `@ts-linq/types` → `@ts-linq/metadata`.

**Known limitation:** ECMAScript `#field` (stage-3 hard-private) is not reflectable; documented as follow-up escape hatch.
