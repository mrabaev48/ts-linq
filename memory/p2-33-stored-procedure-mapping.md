---
name: p2-33-stored-procedure-mapping
description: Stored procedure CUD mapping — StoredProcedureBuilder, SpCallSyntax, SpExecutor, dialect CALL/EXEC emitters
metadata:
  type: project
---

P2-33 implemented: stored procedure mapping for Insert/Update/Delete operations.

**Why:** Enterprise databases route write paths through stored procedures for auditing, row-level security, or direct-DML restrictions.

**How to apply:** When modifying SaveChanges pipeline, be aware SP-mapped entities bypass BatchExecutor and run per-row through SpExecutor.

## Architecture Decisions

- **Strategy Pattern (Option A)**: SP-mapped entities are partitioned from DML changes before BatchExecutor runs. SpExecutor handles each one individually.
- **SpCallSyntax interface** lives in `@ts-linq/types` (alongside SqlDialect). CallSyntaxEmitter (PG/MySQL) and ExecSyntaxEmitter (MSSQL) implement it in `@ts-linq/sql-visitor`.
- **StoredProcedureBuilder<T>** and **SpParamBuilder** live in `@ts-linq/metadata/src/stored-procedure-mapping.ts`. The SP metadata types (EntityStoredProcedureMapping, StoredProcedureConfig, SpParameterMapping, etc.) live in `@ts-linq/types`.
- **MetadataRegistry** has `setStoredProcedureMapping()` / `getStoredProcedureMapping()` stored in a separate `spMappings` Map (not mixed into EntityMetadata — SP mapping is runtime routing metadata, not schema metadata).
- **No migration changes**: SPs are pre-existing DB objects. SchemaSnapshot and DDL emission untouched.

## Key Files

- `packages/types/src/index.ts` — `SpCallSyntax`, `StoredProcedureConfig`, `EntityStoredProcedureMapping`, `SpParameterMapping`, `SpParameterDirection`, `SpRowsAffectedMode`, `SpCallResult`; `SqlDialect.getSpCallSyntax?()`
- `packages/metadata/src/stored-procedure-mapping.ts` — `StoredProcedureBuilder<T>`, `SpParamBuilder` (re-exports types from @ts-linq/types)
- `packages/metadata/src/MetadataRegistry.ts` — `setStoredProcedureMapping()`, `getStoredProcedureMapping()`
- `packages/orm/src/builders/EntityTypeBuilder.ts` — `insertUsingStoredProcedure()`, `updateUsingStoredProcedure()`, `deleteUsingStoredProcedure()`
- `packages/orm/src/save-changes/sp-executor.ts` — `SpExecutor` class: `hasSp()`, `executeInsert/Update/Delete()`
- `packages/orm/src/DbContext.ts` — `_spExecutor` field; partitioning logic in `saveChanges()` batch path; `processChange()` SP check
- `packages/sql-visitor/src/sp-call-emitter.ts` — `CallSyntaxEmitter` (postgres/mysql), `ExecSyntaxEmitter` (mssql)
- `packages/dialect-*/src/sp-syntax.ts` — factory functions; dialect classes implement `getSpCallSyntax()`

## Known Limitations

- SP-mapped entities bypass `maxBatchSize` batching (P2-46 regression documented)
- MySQL OUT params require follow-up `SELECT @paramName` (extra round-trip per entity with output params)
- `hasRowsAffectedReturnValue()` is MSSQL-only; PG/MySQL should use `hasRowsAffectedResultColumn()`
