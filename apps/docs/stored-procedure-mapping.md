# Stored Procedure Mapping for Insert / Update / Delete

## Overview

`ts-linq` lets you redirect any entity's INSERT, UPDATE, or DELETE operations
to existing database stored procedures. This is useful when:

- DBAs own the write paths and enforce constraints inside procedures.
- Auditing or row-level security lives in the procedure, not in the application.
- Legacy schemas prohibit direct DML on tables.

The API mirrors EF Core 7+'s `InsertUsingStoredProcedure` / `UpdateUsingStoredProcedure` /
`DeleteUsingStoredProcedure`.

---

## Fluent Configuration

```ts
class AppContext extends DbContext {
  protected onModelCreating(builder: ModelBuilder): void {
    builder.entity<Person>()
      .insertUsingStoredProcedure(
        'Person_Insert',
        spb => spb
          .hasParameter(p => p.name)
          .hasParameter(p => p.id, p => p.isOutput())   // PK written back after insert
      )
      .updateUsingStoredProcedure(
        'Person_Update',
        spb => spb
          .hasOriginalValueParameter(p => p.id)          // bind snapshot value for WHERE
          .hasParameter(p => p.name)
          .hasRowsAffectedResultColumn()                 // SP returns a result set with rows_affected
      )
      .deleteUsingStoredProcedure(
        'Person_Delete',
        spb => spb.hasOriginalValueParameter(p => p.id)
      );
  }
}
```

---

## StoredProcedureBuilder API

| Method | Description |
|--------|-------------|
| `hasParameter(selector, cfg?)` | Add an INPUT parameter bound to the current entity value. Pass `cfg` to set direction or rename. |
| `hasOriginalValueParameter(selector)` | Add an INPUT parameter bound to the **original** (snapshot) entity value — useful for optimistic concurrency WHERE clauses. |
| `hasRowsAffectedParameter(name?)` | The SP accepts an OUTPUT parameter that receives the rows affected count. |
| `hasRowsAffectedResultColumn()` | The SP returns a result set whose first row has a `rows_affected` column. |
| `hasRowsAffectedReturnValue()` | **MSSQL only.** The executor appends `SELECT @@ROWCOUNT` and reads the result. |

### SpParamBuilder API

Passed as the second argument to `hasParameter`:

| Method | Description |
|--------|-------------|
| `isOutput()` | Mark parameter as OUTPUT — value is written back to the entity after the call. |
| `isInputOutput()` | Mark as INOUT. |
| `hasName(dbName)` | Override the DB parameter name (default: property name). |

---

## Dialect-Specific Syntax

### PostgreSQL — `CALL`

```sql
CALL Person_Insert($1, $2)       -- $1 = name, $2 = NULL (output, written back)
```

PostgreSQL returns OUT parameter values as result-set columns from the `CALL` statement.

### MySQL — `CALL`

```sql
CALL Person_Insert(?, @id)       -- @id is a session variable for OUT param
SELECT @id AS id                 -- follow-up query to read the value back
```

MySQL OUT parameters are read via a `SELECT @paramName` query issued automatically
after the `CALL`.

### MSSQL — `EXEC`

```sql
EXEC Person_Insert @name = @v0, @id = @v1 OUTPUT
```

For `hasRowsAffectedReturnValue()`:

```sql
EXEC Person_Update @id = @v0, @name = @v1; SELECT @@ROWCOUNT AS rows_affected
```

---

## Behaviour Notes

- **PK writeback**: Any `output` parameter value is automatically written back to the entity object after the call. This allows generated primary keys to be propagated back.
- **BatchExecutor bypass**: Entities mapped to stored procedures are **not** batched. They are executed row-by-row regardless of `maxBatchSize`. Document this in your schema notes.
- **No migration support**: Stored procedures are assumed to be pre-existing DB objects. `ts-linq` does not emit `CREATE PROCEDURE` DDL in migrations.
- **Concurrency**: Use `hasOriginalValueParameter` for the row version or PK to pass the original value to the WHERE clause inside the procedure. Use `hasRowsAffectedResultColumn` or `hasRowsAffectedReturnValue` so `ts-linq` can detect optimistic concurrency failures (0 rows affected).

---

## Example: MSSQL Stored Procedures

```sql
-- Insert procedure (SQL Server)
CREATE PROCEDURE dbo.Person_Insert
  @name NVARCHAR(100),
  @id   INT OUTPUT
AS
BEGIN
  INSERT INTO Person (name) VALUES (@name);
  SET @id = SCOPE_IDENTITY();
END;

-- Update procedure
CREATE PROCEDURE dbo.Person_Update
  @id   INT,
  @name NVARCHAR(100)
AS
BEGIN
  UPDATE Person SET name = @name WHERE id = @id;
  SELECT @@ROWCOUNT AS rows_affected;
END;

-- Delete procedure
CREATE PROCEDURE dbo.Person_Delete
  @id INT
AS
BEGIN
  DELETE FROM Person WHERE id = @id;
END;
```

## Example: PostgreSQL Stored Procedures

```sql
-- Insert procedure (PostgreSQL)
CREATE OR REPLACE PROCEDURE person_insert(
  p_name TEXT,
  OUT p_id INT
) LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO person (name) VALUES (p_name) RETURNING id INTO p_id;
END;
$$;
```
