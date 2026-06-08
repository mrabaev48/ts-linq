---
"@ts-linq/types": major
"@ts-linq/metadata": major
"@ts-linq/core": major
"@ts-linq/orm": major
"@ts-linq/provider-mysql": major
"@ts-linq/provider-postgres": major
"@ts-linq/provider-mssql": major
"@ts-linq/query": patch
"@ts-linq/plugin-audit": patch
"@ts-linq/plugin-soft-delete": patch
"@ts-linq/plugin-multi-tenant": patch
---

Replace the opaque `Function` entity-target type with real constructor types across the
metadata API and the contracts that thread an entity class.

**What changed**

- **`@ts-linq/types`** — adds `EntityCtorRef` (`abstract new (...args: unknown[]) => unknown`):
  the constructor reference accepted by metadata **read/lookup** APIs. It rejects plain
  (non-constructor) functions but, unlike `EntityCtor` (`=> object`), also accepts projection
  element constructors such as the `new () => string` produced by `Queryable.select(x => x.name)`.
  The read/write metadata ports and the entity-class fields are narrowed off `Function`:
  - `MetadataSource` read methods (`getEntity`, `getValidationRules`, `getOwnedEntities`,
    `getStoredProcedureMapping`) → `EntityCtorRef`; `MetadataSink` write methods → `EntityCtor`.
  - `TrackedEntity.entityClass`, `EntityChangeContext.entityClass`,
    `FallbackRequest.entityClass`/`entity`, `EntityCacheLike` get/set/remove, and
    `EntityAttacher.attach` → `EntityCtorRef`.
- **`@ts-linq/metadata`** — `MetadataRegistry`/`MetadataStorage` and the facet stores are keyed on
  `EntityCtor` (writes) / `EntityCtorRef` (reads). `Function` is eliminated from the package source
  (enforced by newly-enabled `@typescript-eslint/no-unsafe-function-type` and
  `no-unnecessary-type-assertion` rules); the only remaining `as unknown as` is the single audited
  `reflectUtils` capability probe. `EntityMetadataBuilder`'s internal state collapses to a single
  `Partial<EntityMetadata>`.
- **`@ts-linq/core`** — `DatabaseProvider` CUD method parameters and the mapping decorators
  (`@Entity`, `@Column`, `@PrimaryKey`, relationships, `@Index`, `@ValidIf`) are narrowed off
  `Function`. Decorating a non-class (or a class with a required-argument constructor) is now a
  compile-time error.
- **`@ts-linq/orm`**, **provider-mysql/postgres/mssql** — entity-class parameters/fields narrowed to
  match the contracts above.

**Migration**

Pass a class constructor reference (entity classes are parameterless) to metadata, provider, and
decorator APIs. A bare `Function` value — or a plain (non-constructor) function — is no longer
accepted and becomes a compile-time error. This only affects code that was previously passing
non-constructor values, which was already incorrect at runtime.
