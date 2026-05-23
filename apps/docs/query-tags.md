# Query Tags and Call-Site Tagging

> **EF Core parity**: `IQueryable<T>.TagWith("name")` / `IQueryable<T>.TagWithCallSite()` (EF Core 8).

## Overview

`tagWith()` and `tagWithCallSite()` inject SQL single-line comments before the emitted statement.
The same query can then be identified in DBA tools, query stores (`pg_stat_statements`, MSSQL Query Store),
and slow-query logs without any ambiguity.

## Basic usage

```ts
const orders = await ctx.orders
  .tagWith('dashboard-top-orders')
  .where(o => o.status === 'OPEN')
  .toArray();

// Emitted SQL:
// -- dashboard-top-orders
// SELECT * FROM orders WHERE status = ?
```

## Multiple tags

Chain as many `tagWith()` calls as needed. Tags appear in call order.

```ts
const results = await ctx.orders
  .tagWith('module:billing')
  .tagWith('query:open-orders')
  .toArray();

// -- module:billing
// -- query:open-orders
// SELECT ...
```

## Auto call-site capture

`tagWithCallSite()` captures the caller's source file and line number at runtime
using `Error().stack` (V8-specific, reliable in Node.js).

```ts
const hot = await ctx.orders
  .tagWith('dashboard-top-orders')
  .tagWithCallSite()
  .where(o => o.status === 'OPEN')
  .toArray();

// -- dashboard-top-orders
// -- File: /src/billing/orders-controller.ts:42
// SELECT ...
```

## Read attached tags

Use `getTags()` to inspect the current tag list without executing the query.

```ts
const query = ctx.orders.tagWith('a').tagWith('b');
query.getTags(); // → ['a', 'b']
```

## Sanitization rules

Tags must be single-line. The following characters/sequences are **rejected** with a `QueryTagError`:

| Forbidden | Reason |
|-----------|--------|
| `\n` (newline) | Would break the single-line comment and inject SQL |
| `\r` (carriage return) | Same as above |
| `*/` | Would break block-comment syntax in some contexts |

Validation happens **at call time** (not at query execution time), so the error surface is as close to the source as possible.

```ts
// Throws immediately:
ctx.orders.tagWith('bad\ntag');   // QueryTagError: tag must not contain newline characters
ctx.orders.tagWith('bad */ tag'); // QueryTagError: tag must not contain comment-break sequence
```

## Telemetry / OpenTelemetry

When using `TelemetryProvider`, tags are automatically extracted from the leading SQL comments and
added to the `db.query` span as the `db.query.tags` attribute (JSON-encoded string array).

```
Span: db.query
  db.system        = "postgresql"
  db.statement     = "-- dashboard-top-orders\nSELECT ..."
  db.query.tags    = '["dashboard-top-orders","File: /src/ctrl.ts:42"]'
  db.duration_ms   = 3.14
```

This enables filtering by tag in any OTEL-compatible backend (Jaeger, Tempo, Honeycomb, DataDog, etc.)
without parsing the raw SQL string.

## Immutability

Each fluent method returns a **clone** of the query. Tags set on one chain do not affect sibling chains.

```ts
const base   = ctx.orders;
const tagged = base.tagWith('report');

// Only `tagged` emits the tag comment; `base` is unmodified.
await tagged.toArray(); // -- report\nSELECT ...
await base.toArray();   // SELECT ...
```

## API Reference

### `tagWith(tag: string): Queryable<T>`

Attach a diagnostic tag to the query chain. The tag is rendered as a `-- <tag>` SQL comment
immediately before the statement.

**Parameters**
- `tag` — A single-line string label. Must not contain `\r`, `\n`, or `*/`.

**Throws** `QueryTagError` when the tag value contains forbidden characters.

---

### `tagWithCallSite(): Queryable<T>`

Capture the caller's source location and append it as a tag in the format `File: <path>:<line>`.
Uses V8 `Error().stack` parsing; reliable in all Node.js runtimes.

---

### `getTags(): QueryTagList`

Return the ordered list of tags currently attached to this query chain.
Returns an empty array when no tags have been set.

---

### `sanitizeTag(tag: string): string`

Exported utility. Validates a tag string and returns it unchanged, or throws `QueryTagError`.

---

### `emitTagComments(tags: readonly string[]): string`

Exported from `@ts-linq/sql-visitor`. Converts a tag list to a SQL comment block string.

```ts
emitTagComments(['a', 'b']) // → "-- a\n-- b\n"
```

---

### `parseTagsFromSql(sql: string): readonly string[] | undefined`

Exported from `@ts-linq/telemetry`. Extracts leading `-- ` comment lines from a SQL string.
Returns `undefined` when no tags are found.

## Related tasks

- [P2-45 Logging / Diagnostics](./P2-45-logging-diagnostics.md) — tags must flow into the `LogTo` sink.
