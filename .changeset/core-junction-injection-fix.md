---
'@ts-linq/types': minor
'@ts-linq/core': patch
---

Security: close the SQL-injection vector in `RelationshipLoader` junction (many-to-many) reads.

`@ts-linq/core` no longer builds raw, string-interpolated SQL in the loading layer. Junction
reads now go through a new dialect-aware provider capability,
`DatabaseProvider.queryJunction(spec: JunctionQuerySpec)`, which validates every identifier
(`^[A-Za-z_][A-Za-z0-9_]*$`, failing closed with the new typed `InvalidIdentifierError`) and
quotes it via the dialect's `quoteIdentifier`, while binding all filter values as parameters.
Providers inherit this safe default; no provider override is required.

`@ts-linq/types` adds two new public exports: the `JunctionQuerySpec` interface and the
`InvalidIdentifierError` error class (with the new `OrmErrorCode.InvalidIdentifier` /
`'INVALID_IDENTIFIER'` code).
