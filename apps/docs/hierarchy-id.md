# HierarchyId Support

`ts-linq` provides first-class `HierarchyId` support mirroring EF Core 8's API for SQL Server,
with a parallel `ltree` mapping for PostgreSQL.

## TypeScript API

```ts
import { HierarchyId } from '@ts-linq/core';

// Create
const root   = HierarchyId.getRoot();          // "/"
const child  = HierarchyId.parse('/1/');        // "/1/"
const deep   = HierarchyId.parse('/1/2/3/');    // "/1/2/3/"

// Navigation
deep.getLevel();              // 3
deep.getAncestor(1);          // HierarchyId → "/1/2/"
deep.getAncestor(3);          // HierarchyId → "/"

// Hierarchy checks
deep.isDescendantOf(child);   // true
child.isDescendantOf(deep);   // false
root.isDescendantOf(root);    // true (self)

// Create children
const firstChild = root.getDescendant();            // "/1/"
const secondChild = root.getDescendant(firstChild); // "/2/"

// String representations
deep.toString();              // "/1/2/3/"
deep.toMssqlString();         // "/1/2/3/"  (same as toString)
deep.toLtreeString();         // "1.2.3"    (Postgres ltree format)
```

## modelBuilder / Entity mapping

```ts
modelBuilder.entity<Node>()
  .property(n => n.path)
  .hasColumnType('hierarchyid'); // or 'ltree' for Postgres
```

## LINQ-style queries

```ts
const descendants = await ctx.nodes
  .where(n => n.path.isDescendantOf(parent.path))
  .orderBy(n => n.path)
  .toArray();
```

> **Note:** Lambda-based WHERE with HierarchyId methods requires the `@ts-linq/transformer`
> extension (compile-time AST transform). Without it, use raw SQL via `executeQuery()`.

## SQL Server (MSSQL)

- Column type: `hierarchyid`
- Wire format: string representation (`/1/2/3/`) passed via `hierarchyid::Parse(?)`
- On read: `mssql` driver returns hierarchyid as string; use `decodeHierarchyId(value)`
- Method translation:

| ts-linq method       | SQL Server SQL                              |
|----------------------|---------------------------------------------|
| `isDescendantOf(p)`  | `col.IsDescendantOf(hierarchyid::Parse(?)) = 1` |
| `getLevel()`         | `col.GetLevel()`                            |
| `getAncestor(n)`     | `col.GetAncestor(?)`                        |

### Codec

```ts
import { encodeHierarchyId, decodeHierarchyId } from '@ts-linq/provider-mssql';

const encoded = encodeHierarchyId(HierarchyId.parse('/1/2/')); // "/1/2/"
const decoded = decodeHierarchyId('/1/2/');                    // HierarchyId
```

## PostgreSQL (ltree)

- Column type: `ltree` (requires `CREATE EXTENSION ltree`)
- Wire format: dot-separated string (`1.2.3`)
- Method translation:

| ts-linq method       | PostgreSQL SQL                               |
|----------------------|----------------------------------------------|
| `isDescendantOf(p)`  | `col <@ ?::ltree`                            |
| `getLevel()`         | `nlevel(col)`                                |
| `getAncestor(n)`     | `subpath(col, 0, nlevel(col) - ?)`           |

### Codec

```ts
import { encodeLtree, decodeLtree } from '@ts-linq/provider-postgres';

const ltreeStr = encodeLtree(HierarchyId.parse('/1/2/')); // "1.2"
const h        = decodeLtree('1.2');                      // HierarchyId → "/1/2/"
```

### Root node limitation

PostgreSQL `ltree` paths must be non-empty. The root node `/` encodes to an empty string `""`,
which is **not** a valid `ltree` label. Storing the root node in a Postgres `ltree` column
requires a convention (e.g., use `'_root_'` as the label and document it in your schema).
This is documented as a known gap.

## Gap List (MSSQL-only operations)

The following SQL Server `hierarchyid` methods have **no clean ltree equivalent** and are
therefore not included in the portable `HierarchyIdTranslator` interface:

| MSSQL method           | Description                                        | Status   |
|------------------------|----------------------------------------------------|----------|
| `GetReparentedValue()` | Move a subtree under a new parent                  | MSSQL only |
| `Parse()`              | Static factory from string (handled internally)    | Internal |

These operations can be performed via raw SQL using `provider.executeNonQuery()` when
targeting SQL Server directly.

## SqlVisitor integration

```ts
import { SqlVisitor } from '@ts-linq/sql-visitor';
import { mssqlHierarchyFunctions } from '@ts-linq/dialect-mssql';

const visitor = new SqlVisitor(ParameterStyle.Named, {
  hierarchyTranslator: mssqlHierarchyFunctions
});

const { condition, parameters } = visitor.toSql(expressionNode, inputParams);
```
