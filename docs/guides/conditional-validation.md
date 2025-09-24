Conditional Validation (ValidIf) — Guide and Limitations

This guide explains how Conditional Validation works in the ORM, its limitations, and recommended best practices. It complements base model validation (NotNull/length) enforced by metadata.

Concepts

- Base validation (NotNull/length/readonly) is executed first.
- Conditional rules are registered via Stage‑3 field decorators (or programmatically) and run after base checks.
- Rules live in metadata (Reflect) and are executed in DbContext.saveChanges() for entities with state Added/Modified.

DX & Typing Helpers

- ValidIf(predicate, message?): untyped predicate signature.
- ValidIfOf<T>(predicate: (entity: Readonly<T>) => boolean, message?): type‑safe variant.
- Common helpers:
  - RequiredIfOf<T>(condition, message?): requires a non‑empty value when condition is true
  - MinLengthOf<T>(min, message?), MaxLengthOf<T>(max, message?)
  - PatternOf<T>(regex, message?)
  - RangeOf<T>(min?, max?, message?)

These helpers install rules into metadata using Stage‑3 initializers and are provider‑agnostic.

Execution Order and Audit Compatibility

- Order: base checks → ValidIf rules. This ensures default values and NotNull/length semantics are respected before conditional rules.
- Audit stamping (createdAt/createdBy/updatedAt/updatedBy) is compatible: base NotNull can be satisfied by audit layer during saveChanges.

Limitations

- Conditional validation runs in the application process (not in the database).
- It cannot protect against concurrent writes from other processes or direct SQL changes.
- Complex rules may be expensive; avoid IO and heavy computations in predicates.

Best Practices

- Keep predicates pure and fast; avoid side‑effects and external calls. Do not call databases, HTTP services, or perform heavy computations inside predicates.
- Co‑locate common rules using helpers; prefer typed version ValidIfOf<T>.
- Prefer base constraints in metadata (nullable/length) where possible.
- Use meaningful messages to aggregate and display multiple errors.
- Use the built‑in per‑class rules cache (DbContext) to avoid repeated metadata lookups.

Strong Recommendation: Duplicate Critical Rules in the Database

For invariants that must always hold (referential integrity, uniqueness, non‑nulls, numeric ranges, cross‑field constraints that affect data correctness), duplicate them at the database level:

- Non‑nulls: NOT NULL
- Ranges: CHECK (price >= 0)
- Conditional invariants: CHECK (status <> 'published' OR title <> '') (adapt per engine)
- Uniqueness: UNIQUE index

This provides defense‑in‑depth and protects against out‑of‑process writers or disabled application checks.

Example

```ts
import { ValidIfOf, RequiredIfOf, MinLengthOf } from '@ts-linq/core';

class Article {
  id!: number;
  title!: string;
  status!: 'draft' | 'published';
}

// Title is required when published
@RequiredIfOf<Article>((a) => a.status === 'published', 'Title is required for published')
// Title must be at least 3 characters when present
@MinLengthOf<Article>(3)
public title!: string;
```

Matching DB constraint (PostgreSQL):

```sql
ALTER TABLE "Articles"
  ADD CONSTRAINT articles_title_when_published
  CHECK (status <> 'published' OR length(title) >= 3);
```

Testing

- Unit: registration, multiple rules aggregation, order (base → ValidIf), typed helpers.
- Integration: SQLite executed by default; PostgreSQL/MySQL/MSSQL scenarios enabled when URLs are provided.


