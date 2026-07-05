# @ts-linq/dialect-kit

Shared, stateless SQL clause emitters used by the ts-linq dialects
(`@ts-linq/dialect-postgres`, `@ts-linq/dialect-mysql`, `@ts-linq/dialect-mssql`).

Each dialect used to carry its own near-identical `WHERE` / `JOIN` / `GROUP BY` / `ORDER BY`
emitter classes. This package collapses those into four pure functions, so clause rendering has a
single source of truth and cannot drift between dialects.

## Exports

| Function | Signature | Notes |
|---|---|---|
| `emitWhere` | `(parameters, options) => string` | Dialect-agnostic; appends bound params. |
| `emitJoin` | `(options, quote) => string` | Identifier quoting injected via `quote`. |
| `emitGroup` | `(parameters, options) => string` | Guards empty columns — no dangling `GROUP BY`. |
| `emitOrder` | `(options) => string` | Dialect-agnostic. |

## Design

Pure function / Strategy injection: the only dialect-specific concern (identifier quoting) is
passed into `emitJoin` as a `quote: (id: string) => string` callback rather than held as state.
One tested implementation, reusable across dialects, no inheritance.
