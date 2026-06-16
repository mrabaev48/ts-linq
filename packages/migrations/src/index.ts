/**
 * Barrel file re-exporting migration building blocks.
 * Import from '@ts-linq/migrations' to access the public migration API.
 */
export {
  buildAddFkSql,
  buildDropFkSql,
  buildInlineFkSql,
  deleteBehaviorToSql
} from './builders/handlers/ForeignKeyHandlers';
export { buildCreateIndexSql } from './builders/handlers/IndexHandlers';
export { buildCreateTableSql } from './builders/handlers/TableHandlers';
export {
  buildAddUniqueConstraintSql,
  buildDropUniqueConstraintSql
} from './builders/UniqueConstraintsSqlBuilder';
export * from './bundle/build-bundle';
export * from './DialectMigrationSql';
export * from './DiffBasedMigration';
export * from './DiffMigrationGenerator';
export * from './DiffTypes';
export * from './errors';
export * from './Migration';
export * from './MigrationBuilder';
export * from './MigrationFileBuilder';
export * from './MigrationRunner';
export { DefaultMigrationHistoryStore } from './runner/DefaultMigrationHistoryStore';
export type { MigrationHistoryStore } from './runner/MigrationHistoryStore';
export type { MigrationLogger } from './runner/MigrationLogger';
export { NO_OP_LOGGER } from './runner/MigrationLogger';
export { buildEnsureMigrationsTableSql, MIGRATIONS_TABLE } from './runner/MigrationsTableSchema';
export type { TransactionCapableProvider } from './runner/TransactionScope';
export { TransactionScope } from './runner/TransactionScope';
export * from './scaffold/name-normalizer';
export type { ScaffoldOptions } from './scaffold/scaffold-db-context';
export { scaffoldDbContext } from './scaffold/scaffold-db-context';
export * from './scaffold/types';
export * from './SchemaComparator';
export * from './SchemaSnapshot';
export * from './script/idempotent-emitter';
export * from './snapshot/diff';
export * from './snapshot/model-snapshot';
