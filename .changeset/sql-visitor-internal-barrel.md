---
"@ts-linq/sql-visitor": major
---

Curate the public barrel of `@ts-linq/sql-visitor` to the intended published contract.

The package now exports only `SqlVisitor`/`SqlVisitorOptions`, `ParameterState`/`ParameterStyle`,
the rewriters (`JsonAccessRewriter`, `ComplexAccessRewriter`), the emitters (`CallSyntaxEmitter`,
`ExecSyntaxEmitter`, `emitTagComments`, and the batch helpers `buildQuestionMarkRows`,
`calcChunkSize`, `chunkArray`), and the translator / fragment / port *types*.

**Breaking:** the sub-visitors (`BinaryVisitor`, `EfFunctionVisitor`, `FragmentJoinPlanner`,
`HierarchyMethodVisitor`, `InVisitor`, `JsonPathVisitor`, `LogicalVisitor`, `MethodVisitor`,
`NullVisitor`, `SpatialMethodVisitor`, `UnaryVisitor`) and the free helpers (`renderPropertyName`,
`resolveParameterRef`, `isHierarchyMethod`, `isSpatialMethod`) are no longer exported from
`@ts-linq/sql-visitor`. They are implementation collaborators of `SqlVisitor` and now live behind
the new `@ts-linq/sql-visitor/internal` subpath.

**Migration:** prefer `SqlVisitor` for all SQL generation. If you must reach into a sub-visitor,
import it from `@ts-linq/sql-visitor/internal` (unstable — may change without notice). Example:

```ts
// before
import { FragmentJoinPlanner } from '@ts-linq/sql-visitor';
// after
import { FragmentJoinPlanner } from '@ts-linq/sql-visitor/internal';
```
