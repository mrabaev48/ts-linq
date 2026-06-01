# Value Generators and Sentinel — ts-linq

ts-linq supports pluggable value generation for entity properties, mirroring EF Core's `ValueGeneratedOnAdd` / `OnUpdate` / `HasValueGenerator` / `HasSentinel` API.

---

## Value generation policies

Configure how a column's value is produced during `saveChanges()`:

| Method | Policy | When it runs |
|---|---|---|
| `valueGeneratedOnAdd()` | `OnAdd` | INSERT only |
| `valueGeneratedOnUpdate()` | `OnUpdate` | UPDATE only |
| `valueGeneratedOnAddOrUpdate()` | `OnAddOrUpdate` | Both INSERT and UPDATE |
| `valueGeneratedNever()` | `Never` | Never — user value always wins |

```ts
modelBuilder.entity<Post>(Post).property(p => p.id)
  .valueGeneratedOnAdd();

modelBuilder.entity<Post>(Post).property(p => p.updatedAt)
  .valueGeneratedOnAddOrUpdate();
```

When no `hasValueGenerator()` is attached, the column is treated as **DB-side generated** (IDENTITY / SERIAL / SEQUENCE). The value is omitted from the INSERT statement and read back from the database.

---

## Client-side value generators

Attach a custom generator class with `hasValueGenerator()`. The generator is instantiated once per property per `saveChanges()` call.

```ts
modelBuilder.entity<Post>(Post).property(p => p.externalId)
  .valueGeneratedOnAdd()
  .hasValueGenerator(UlidValueGenerator);
```

### Built-in generators

| Class | Produces | Import |
|---|---|---|
| `UlidValueGenerator` | Crockford Base32 ULID (26 chars) | `@ts-linq/orm` |
| `UuidV7ValueGenerator` | Time-ordered UUID v7 string | `@ts-linq/orm` |
| `UtcNowValueGenerator` | `new Date()` (UTC timestamp) | `@ts-linq/orm` |

### Custom generators

Implement the `ValueGenerator<T>` interface from `@ts-linq/metadata`:

```ts
import type { ValueGenerator, ValueGeneratorContext } from '@ts-linq/metadata';

class NanoIdValueGenerator implements ValueGenerator<string> {
  next(_ctx: ValueGeneratorContext): string {
    return nanoid();
  }
}

modelBuilder.entity<Order>(Order).property(p => p.id)
  .valueGeneratedOnAdd()
  .hasValueGenerator(NanoIdValueGenerator);
```

---

## Sentinel

A **sentinel** marks the "not-set" value for a property. When the property equals the sentinel, the client-side generator runs. When the property holds any other value, the user's value is preserved.

This solves the `0` / `""` problem: without a sentinel, `undefined` is the only "unset" marker, making `0` ambiguous.

```ts
// -1 means "not set" — generator fires when sortOrder === -1
modelBuilder.entity<Post>(Post).property(p => p.sortOrder)
  .valueGeneratedOnAdd()
  .hasValueGenerator(MySequenceGenerator)
  .hasSentinel(-1);
```

```ts
// '' means "not set" — generator fires when externalId === ''
modelBuilder.entity<Post>(Post).property(p => p.externalId)
  .valueGeneratedOnAdd()
  .hasValueGenerator(UlidValueGenerator)
  .hasSentinel('');
```

---

## Decision precedence

For each property during `saveChanges()`:

1. If `valueGeneratedPolicy === Never` → use user value, no generation.
2. If policy doesn't match the operation (e.g. `OnAdd` during UPDATE) → use user value.
3. If `valueGeneratorClass` is set:
   - If current value equals sentinel (or is `undefined` when no sentinel is configured) → invoke generator, assign result.
   - Otherwise → preserve user value.
4. If no `valueGeneratorClass` (DB-side) → omit column from INSERT (IDENTITY / SERIAL handles it).

---

## Related features

- **P1-21 HiLo / Sequences** — `HiLoValueGenerator` will implement `ValueGenerator<number>` once P1-21 is implemented.
- **P1-16 Shadow properties** — combine `valueGeneratedOnAddOrUpdate()` with a shadow `updatedAt` property for automatic timestamp management.
