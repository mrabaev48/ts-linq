import type { DdlStrategy } from '@ts-linq/types';

import type { Dialect } from '../Dialect';
import type { TableDiff, UniqueConstraintDef } from '../DiffTypes';
import { createDdlStrategy } from './ddl/DdlStrategyFactory';

/**
 * Named UNIQUE constraint (alternate key) DDL.
 *
 * Both statements come from the shared per-dialect {@link DdlStrategy}, which owns the
 * `ADD CONSTRAINT … UNIQUE` / MySQL `ADD UNIQUE KEY` and `DROP CONSTRAINT [IF EXISTS]` / MySQL
 * `DROP INDEX` divergences together with the identifier quoting
 * (`dialect-postgres/task-10`). The two dialect-keyed functions below are kept as thin adapters
 * over that strategy so the package's published surface is unchanged.
 */
export function buildAddUniqueConstraintSql(
  dialect: Dialect,
  tableName: string,
  uc: UniqueConstraintDef
): string {
  return createDdlStrategy(dialect).generateAddUniqueConstraintSql(tableName, uc.name, uc.columns);
}

export function buildDropUniqueConstraintSql(
  dialect: Dialect,
  tableName: string,
  name: string
): string {
  return createDdlStrategy(dialect).generateDropUniqueConstraintSql(tableName, name);
}

export function handleUniqueConstraintCreates(ddl: DdlStrategy, td: TableDiff, up: string[]): void {
  if (!td.uniqueConstraintCreates || td.uniqueConstraintCreates.length === 0) return;
  for (const uc of td.uniqueConstraintCreates) {
    up.push(ddl.generateAddUniqueConstraintSql(td.table, uc.name, uc.columns));
  }
}

export function handleUniqueConstraintDrops(ddl: DdlStrategy, td: TableDiff, up: string[]): void {
  if (!td.uniqueConstraintDrops || td.uniqueConstraintDrops.length === 0) return;
  for (const name of td.uniqueConstraintDrops) {
    up.push(ddl.generateDropUniqueConstraintSql(td.table, name));
  }
}

export class UniqueConstraintsSqlBuilder {
  constructor(private readonly ddl: DdlStrategy) {}

  create(td: TableDiff, up: string[]): void {
    handleUniqueConstraintCreates(this.ddl, td, up);
  }

  drop(td: TableDiff, up: string[]): void {
    handleUniqueConstraintDrops(this.ddl, td, up);
  }
}
