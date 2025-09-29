Database Functions — Guide and Dialect Compatibility

This guide explains how to use database functions in column defaults and expressions, and how to make them portable across dialects using typed metadata and decorator helpers.

Overview

- Use default expressions for server‑evaluated values on INSERT (e.g., timestamps, UUIDs).
- For cross‑dialect portability, specify dialect aliases via `defaultExpressionDialect` or a helper decorator.
- Computed columns vs default expressions:
  - defaultExpression: evaluated once at INSERT; column remains writable
  - computed (generated): derived and read‑only; see computed‑columns guide

Typed metadata

You can set a function in `defaultExpression` or per‑dialect in `defaultExpressionDialect`:

```ts
MetadataStorage.addColumn(User, {
  propertyName: 'createdAt',
  columnName: 'created_at',
  type: 'DATETIME',
  nullable: false,
  defaultExpressionDialect: {
    postgresql: 'CURRENT_TIMESTAMP',
    mysql: 'CURRENT_TIMESTAMP',
    sqlite: 'CURRENT_TIMESTAMP',
    mssql: 'SYSDATETIME()'
  }
});
```

Decorator helper (Stage‑3)

If you use decorators, provide dialect aliases with your helper/decorator (example):

```ts
// Pseudo‑decorator example if you defined one, otherwise prefer metadata API above
@DatabaseFunction({
  defaultExpressionDialect: {
    postgresql: 'gen_random_uuid()', // requires pgcrypto or extension
    mysql: 'UUID()',
    sqlite: "lower(hex(randomblob(16)))",
    mssql: 'NEWID()'
  }
})
@Column()
id!: string;
```

Compatibility table (common functions)

| Purpose           | PostgreSQL                             | MySQL                   | SQLite                     | MSSQL                        |
| ----------------- | -------------------------------------- | ----------------------- | -------------------------- | ---------------------------- | --- | --- | --- | ---------------------------- |
| Current timestamp | CURRENT_TIMESTAMP                      | CURRENT_TIMESTAMP       | CURRENT_TIMESTAMP          | SYSDATETIME() (or GETDATE()) |
| UUID v4           | gen_random_uuid() / uuid_generate_v4() | UUID()                  | lower(hex(randomblob(16))) | NEWID()                      |
| Random            | random()                               | RAND()                  | random()                   | RAND()                       |
| String concat     | 'a'                                    |                         | 'b'                        | CONCAT('a','b') or 'a''b'    | 'a' |     | 'b' | 'a' + 'b' or CONCAT('a','b') |
| JSON extract      | ->, ->>, jsonb\_\*                     | JSON*EXTRACT(), JSON*\* | json*extract(), json*\*    | JSON_VALUE(), JSON_QUERY()   |

Notes & limitations

- Extensions: Some functions require extensions/plugins (e.g., Postgres `uuid_generate_v4()` or `gen_random_uuid()`). Ensure they exist in your DB.
- Quoting: Keep raw expressions free of quotes that would convert them to string literals. Use exact function syntax for the engine.
- Defaults vs computed: Defaults are applied once on INSERT; use computed columns for always‑derived values.
- Migrations: Minimal diff emits `DEFAULT <expr>` for add/create; altering defaults varies by engine (e.g., Postgres `ALTER COLUMN SET DEFAULT`).

Examples

Timestamps (portable):

```ts
MetadataStorage.addColumn(AuditLog, {
  propertyName: 'createdAt',
  columnName: 'created_at',
  type: 'DATETIME',
  nullable: false,
  defaultExpressionDialect: {
    postgresql: 'CURRENT_TIMESTAMP',
    mysql: 'CURRENT_TIMESTAMP',
    sqlite: 'CURRENT_TIMESTAMP',
    mssql: 'SYSDATETIME()'
  }
});
```

UUIDs (per dialect):

```ts
MetadataStorage.addColumn(User, {
  propertyName: 'id',
  columnName: 'id',
  type: 'UUID',
  nullable: false,
  defaultExpressionDialect: {
    postgresql: 'gen_random_uuid()',
    mysql: 'UUID()',
    sqlite: 'lower(hex(randomblob(16)))',
    mssql: 'NEWID()'
  }
});
```

JSON defaults (engine specific):

```ts
MetadataStorage.addColumn(Config, {
  propertyName: 'settings',
  columnName: 'settings',
  type: 'JSON',
  nullable: false,
  defaultExpressionDialect: {
    postgresql: "'{}'::jsonb",
    mysql: 'JSON_OBJECT()',
    sqlite: "json('{}')",
    mssql: "JSON_QUERY('{}')"
  }
});
```

Best practices

- Prefer `defaultExpressionDialect` for portability; supply all target engines your app supports.
- Keep expressions simple and engine‑native; avoid relying on functions that vary semantically across engines.
- For critical invariants, duplicate with DB constraints (NOT NULL, CHECK, UNIQUE) even if defaults are provided.
