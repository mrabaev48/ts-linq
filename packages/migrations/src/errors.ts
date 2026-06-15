/**
 * Migration error types.
 *
 * The canonical definitions live in `@ts-linq/types` (the single `OrmError`
 * hierarchy — see CLAUDE.md §16); these are thin re-exports so consumers of
 * `@ts-linq/migrations` can import them without reaching into `@ts-linq/types`.
 */
export {
  BundleBuildError,
  MigrationApplyError,
  MigrationRollbackError,
  ProviderRequiredError,
  SnapshotSerializationError,
  SnapshotValidationError
} from '@ts-linq/types';
