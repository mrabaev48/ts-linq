# @ts-linq/ast

> Query AST node definitions, the JSON-path expression model, and the Specification pattern
> primitives for the ts-linq ORM.

This package defines the **intermediate representation** that sits between user-written LINQ-style
lambdas (parsed by `@ts-linq/transformer`) and SQL generation (`@ts-linq/sql-visitor` + dialects).
It is a pure data layer: node shapes, factory helpers, and reusable query specifications.

## Installation

```bash
pnpm add @ts-linq/ast
```

## What lives here

- **Expression nodes** (`ast/Nodes.ts`) — the AST node union used to describe `where`, `select`,
  `order by`, binary/logical/unary expressions, method calls, and member access.
- **JSON-path expressions** (`ast/JsonPathExpression.ts`) — the model for JSON column access that
  dialects translate to `->`, `->>`, `JSON_VALUE`, etc.
- **Raw SQL node** (`nodes/RawSqlNode.ts`) — escape hatch node carrying provider-rendered SQL
  fragments through the pipeline.
- **Specification pattern** (`spec/Specification.ts`) — composable, reusable predicate objects
  (`and`/`or`/`not`) for building query criteria.
- **Errors** (`errors.ts`) and shared **types** (`types.ts`).

## Usage

```ts
import { Specification } from '@ts-linq/ast';

const activeAdults = new Specification<User>(u => u.isActive)
  .and(u => u.age >= 18);
```

## Package structure

```
src/
  ast/JsonPathExpression.ts   # JSON-path access model
  ast/Nodes.ts                # expression node definitions
  nodes/RawSqlNode.ts         # raw SQL passthrough node
  spec/Specification.ts       # Specification pattern
  errors.ts
  types.ts
  index.ts                    # public barrel
```

## Dependencies

- `@ts-linq/types`

## License

Part of the ts-linq monorepo. See the repository root for license details.
