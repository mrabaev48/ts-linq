# P1-22: EF.Functions and HasDbFunction

**Status:** done (implemented in feat/p1-22-ef-functions branch)

## Architecture

Two-phase: TypeScript AST → ts-linq AST (Transformer) → SQL (sql-visitor)

### New AST Node
`EfFunctionNode` added to `packages/ast/src/ast/Nodes.ts`:
```ts
interface EfFunctionNode { type: 'efFunction'; fn: EfFunction | string; args: (PropertyNode | LiteralNode | ParameterRefNode)[]; }
type EfFunction = 'like' | 'iLike' | 'random' | 'dateDiffDay' | 'dateDiffMonth' | 'greatest' | 'least' | 'stDev' | 'variance';
```
Also added `'efFunction'` to `ExpressionNodeKind` in `packages/transformer/src/nodes/ExpressionNode.ts`.

### New error codes
Added to `packages/ast/src/errors.ts`: `'UNSUPPORTED_FUNCTION'`, `'INVALID_FUNCTION_NODE'`, and `fn` field in `AstSqlGenerationErrorDetails`.

### EF.functions marker
- `packages/query/src/EF.functions.ts` — frozen object, each method throws outside LINQ
- `EF.functions` added as `static readonly` on `EF` class in `packages/query/src/EF.ts`

### Transformer
`packages/transformer/src/expression/visitors/CallVisitor.ts`:
- Detects `EF.functions.xxx(...)` via `isEfFunctionsCall()` helper
- `visitEfFunction()` resolves args: PropertyAccess on param → PropertyNode, literals → LiteralNode, others → ParameterRefNode captured in `tctx.parameters`

### SQL Visitor
- `packages/sql-visitor/src/functions/FunctionTranslator.ts` — `EfFunctionTranslator` interface
- `packages/sql-visitor/src/visitors/EfFunctionVisitor.ts` — dispatch by `node.fn`
- `SqlVisitorOptions` extended with `efFunctionTranslator?` and `userFunctions?: ReadonlyMap<string, string>`

### Dialect translators
- `packages/dialect-postgres/src/functions/index.ts` → `postgresEfFunctions` (includes `iLike`)
- `packages/dialect-mysql/src/functions/index.ts` → `mysqlEfFunctions` (no `iLike`)
- `packages/dialect-mssql/src/functions/index.ts` → `mssqlEfFunctions` (no `iLike`, `GREATEST`/`LEAST` via VALUES subquery)

### ModelBuilder.hasDbFunction
- `packages/orm/src/builders/DbFunctionBuilder.ts` — `DbFunctionBuilder.hasName(sqlName)`
- `ModelBuilder.hasDbFunction(fn)` + `ModelBuilder.getDbFunctionMap()` returning `ReadonlyMap<string, string>` keyed by `fn.name`

## Key limitations
- `iLike` only on PostgreSQL — throws `UNSUPPORTED_FUNCTION` on MySQL/MSSQL
- User-defined functions must be registered via `hasDbFunction().hasName()` before query execution
- `random()` in `orderBy` works (produces `ConditionFragment` where `condition` is the ORDER BY expression)
