---
'@ts-linq/types': major
'@ts-linq/core': major
'@ts-linq/metadata': major
'@ts-linq/orm': major
---

refactor(types): replace `Function` with `EntityCtor`/`EntityRef` in the shared metadata model

Tightens the weak `Function` / `Function | (() => Function)` entity-target types in the shared
metadata model so wrong (non-constructor) values no longer compile, and downstream packages can
drop their `as unknown as` casts.

`@ts-linq/types` now exports two type-only aliases from `metadata.ts` (via the barrel):

- `type EntityCtor = abstract new (...args: unknown[]) => object`
- `type EntityRef = EntityCtor | (() => EntityCtor)`

These replace `Function` in `EntityMetadata.target`/`hierarchyRoot`,
`RelationshipMetadata.targetEntity` (now `string | EntityRef | undefined`),
`RelationshipOptions.targetEntity`, `DiscriminatorEntry.ctor`,
`HierarchyMetadata.rootEntity`/`subtypes`, `OwnedEntityMetadata.ownedType`, and both
`SkipNavigationMetadata` constructor fields. A plain function or arrow function is no longer
assignable to these fields.

**Breaking.** Narrowing the type of exported metadata-interface fields is a breaking change for
any external consumer that assigned a non-constructor. In lockstep, `@ts-linq/core`,
`@ts-linq/metadata` and `@ts-linq/orm` narrowed coordinated public signatures — the relationship
decorators (`OneToMany`/`ManyToOne`/`OneToOne`/`ManyToMany` now take `() => EntityCtor`),
`loadCompiledModel`/`CompiledModelClassMap`/`DbContextOptions.compiledModelClassMap` (now
`Record<string, EntityCtor>`), and the fluent model-builder entity generics (now constrained
`<T extends object>`). These are source-compatible for all conforming code (entity classes are
constructors and objects); only previously-invalid usage stops compiling. No runtime behaviour
changes — the aliases erase at compile time.
