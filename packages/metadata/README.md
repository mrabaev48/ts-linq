# @ts-linq/metadata

> Entity metadata model, decorator metadata storage, the metadata registry, value
> converters/comparers, and compiled-model hydration for the ts-linq ORM.

This package owns the **mapping model**: how TypeScript entity classes map to tables, columns,
keys, relationships, views, sequences, stored procedures, and value conversions. It is consumed by
`core`, `query`, `orm`, `migrations`, dialects, and the CLI.

## Installation

```bash
pnpm add @ts-linq/metadata
```

## What lives here

- **Metadata descriptors** — `EntityMetadata`, `Column`, `PrimaryKey`, `Relationships`,
  `ComputedColumn`, `ViewMetadata`, `DatabaseFunction`, `CachePolicy`.
- **Registry & storage** — `MetadataRegistry` (+ `createMetadataRegistry()`), `MetadataStorage`,
  `PendingMetadataCollector`, `SequenceRegistry`.
- **Value conversion** — `ValueConverter`, `ValueComparer`, and built-ins
  (`BoolToZeroOneConverter`, `DateOnlyToStringConverter`, `EnumToNumberConverter`,
  `EnumToStringConverter`).
- **Property access** — `PropertyAccessMode`, `PropertyAccessor` (backing-field support).
- **Compiled models / AOT** — `CompiledModel`, `compiled-model-hydrator`.
- **Stored procedures** — `stored-procedure-mapping`.
- **Reflection helpers** — `reflectGetOwnMetadata`, `resolveEntityRef`, `ValidIf`.

## Usage

```ts
import { createMetadataRegistry } from '@ts-linq/metadata';

const registry = createMetadataRegistry();
const meta = registry.getEntityMetadata(User);
```

## Package structure

```
src/
  EntityMetadata.ts, Column.ts, PrimaryKey.ts, Relationships.ts, ViewMetadata.ts ...
  MetadataRegistry.ts, MetadataStorage.ts, PendingMetadataCollector.ts, SequenceRegistry.ts
  ValueConverter.ts, ValueComparer.ts, builtins/*
  PropertyAccessMode.ts, PropertyAccessor.ts
  CompiledModel.ts, compiled-model-hydrator.ts
  stored-procedure-mapping.ts
  index.ts                    # public barrel
```

## Dependencies

- `@ts-linq/types`

## License

Part of the ts-linq monorepo. See the repository root for license details.
