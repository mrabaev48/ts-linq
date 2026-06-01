---
"@ts-linq/types": minor
"@ts-linq/metadata": minor
"@ts-linq/orm": minor
"@ts-linq/migrations": minor
"@ts-linq/dialect-mysql": minor
"@ts-linq/core": minor
"@ts-linq/provider-postgres": minor
"@ts-linq/provider-mssql": minor
"@ts-linq/provider-mysql": minor
---

feat(P1-21): implement Sequences and HiLo — ModelBuilder.hasSequence(), PropertyBuilder.useHiLo()/useSequence(), HiLoValueGenerator with per-context block reservation, native CREATE SEQUENCE DDL for PostgreSQL/MSSQL, counter-table emulation for MySQL, full schema diff and migration support
