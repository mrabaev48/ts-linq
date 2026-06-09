---
"@ts-linq/sql-visitor": patch
---

Fix `EfFunctionVisitor` binding an entity column name as a literal SQL parameter when a property
is used in an EF.functions value position.

Previously, a `PropertyNode` argument to `like` / `iLike` / `dateDiffDay` / `dateDiffMonth`
(e.g. `EF.functions.dateDiffDay(a.start, a.end)`) emitted a placeholder (`?` / `$N`) and bound
the **column name string** as the parameter value (with the column resolver dropped), so the
generated SQL compared against the literal string `"end"` instead of the `end` column. A property
in a value position is now inlined as a resolved column reference — no placeholder, no bound
parameter — matching the already-correct variadic path. Literal and parameter-ref arguments are
unchanged.

This path is not yet reachable from `.where()` in the live query pipeline, so the fix is a
pre-emptive correction with no observable change for current consumers.
