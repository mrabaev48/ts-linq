---
'@ts-linq/types': minor
---

feat(types): add OrmError root, OrmErrorCode enum, and standardized error hierarchy; backward-compatible

Introduce an abstract `OrmError` root carrying a stable machine-readable `code`, an optional
structured `details` payload, and a preserved `cause` chain. All existing error classes
(`DatabaseError`, `OptimisticConcurrencyError`, `UniqueConstraintError`,
`ForeignKeyConstraintError`, `ValidationError`, `TemporalNotSupportedError`) are re-rooted under
`OrmError`, so a single `if (e instanceof OrmError)` now catches every ORM failure. Existing class
names, constructor signatures, and `instanceof` checks are unchanged — this is purely additive.

New exported categories (for downstream typed throws): `UnsupportedOperationError`,
`MetadataError`, `DecoratorUsageError`, `BatchConfigurationError`, `InvalidIncludeError`,
`OperationAbortedError`. Also exports `OrmErrorCode` (const-object union of stable codes) and the
`OrmErrorOptions` type.
