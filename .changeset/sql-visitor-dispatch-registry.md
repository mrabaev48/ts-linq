---
"@ts-linq/sql-visitor": major
---

Unify the node-visitor contract and replace the hand-written dispatch switch with a registry.

All sub-visitors now implement a single `NodeVisitor<N>` interface and accept one cohesive
`VisitContext` (`{ inputParameters, resolver, converterResolver, state, recurse }`) instead of
the previous divergent positional parameter lists. `SqlVisitor` dispatches through an internal
`Map<ExpressionNode['type'], NodeVisitor>` (mirroring the transformer's `DISPATCH_MAP`); optional
translators (`efFunction`, `jsonPath`) register their real visitor when configured or a throwing
stub otherwise. `NullVisitor` is unified into a single `visit` (its `visitIsNull` / `visitIsNotNull`
methods are removed). SQL output is byte-identical.

`SqlVisitor`'s public API (`toSql`, the constructor, `SqlVisitorOptions`) is unchanged.

BREAKING: the exported sub-visitor classes (`BinaryVisitor`, `LogicalVisitor`, `UnaryVisitor`,
`NullVisitor`, `InVisitor`, `MethodVisitor`, `EfFunctionVisitor`, `JsonPathVisitor`,
`SpatialMethodVisitor`, `HierarchyMethodVisitor`) now expose `visit(node, ctx: VisitContext)`.
Code that called these visitors directly with positional arguments must build a `VisitContext`.
`NullVisitor.visitIsNull` / `visitIsNotNull` are replaced by `visit`. New exported types:
`NodeVisitor` and `VisitContext`.
