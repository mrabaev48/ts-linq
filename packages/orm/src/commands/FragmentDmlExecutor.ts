import type { DatabaseProvider } from '@ts-linq/core';
import type { EntityMetadata, TableFragmentMetadata } from '@ts-linq/types';

/**
 * Executes per-fragment INSERT / UPDATE / DELETE statements for entity splitting (P1-25).
 *
 * When an entity has `tableFragments`, SaveChanges must issue separate DML for each
 * secondary table in addition to the primary table statement handled by the normal flow.
 */
export class FragmentDmlExecutor {
  constructor(private readonly provider: DatabaseProvider) {}

  /** INSERT the fragment-owned columns into the secondary table. */
  public async insertFragment(
    entity: Record<string, unknown>,
    primaryMeta: EntityMetadata,
    fragment: TableFragmentMetadata
  ): Promise<void> {
    const fragmentMeta = this.buildFragmentMeta(primaryMeta, fragment);
    const dialect = this.provider.getDialect();
    if (!dialect.buildInsert) return;
    const { sql, parameters } = dialect.buildInsert(entity, fragmentMeta);
    await this.provider.executeNonQuery(sql, parameters);
  }

  /** UPDATE the fragment-owned columns in the secondary table. */
  public async updateFragment(
    entity: Record<string, unknown>,
    primaryMeta: EntityMetadata,
    fragment: TableFragmentMetadata,
    originalValues?: object
  ): Promise<void> {
    const fragmentMeta = this.buildFragmentMeta(primaryMeta, fragment);
    const dialect = this.provider.getDialect();
    if (!dialect.buildUpdate) return;
    const { sql, parameters } = dialect.buildUpdate(
      entity,
      fragmentMeta,
      undefined,
      undefined,
      originalValues as Record<string, unknown> | undefined
    );
    await this.provider.executeNonQuery(sql, parameters);
  }

  /** DELETE the row from the secondary fragment table. */
  public async deleteFragment(
    entity: Record<string, unknown>,
    primaryMeta: EntityMetadata,
    fragment: TableFragmentMetadata,
    originalValues?: object
  ): Promise<void> {
    const fragmentMeta = this.buildFragmentMeta(primaryMeta, fragment);
    const dialect = this.provider.getDialect();
    if (!dialect.buildDelete) return;
    const { sql, parameters } = dialect.buildDelete(
      entity,
      fragmentMeta,
      undefined,
      originalValues as Record<string, unknown> | undefined
    );
    await this.provider.executeNonQuery(sql, parameters);
  }

  /**
   * Builds a minimal synthetic `EntityMetadata` containing only the PK columns +
   * the fragment-assigned property columns, mapped to the fragment's table name.
   */
  private buildFragmentMeta(
    primaryMeta: EntityMetadata,
    fragment: TableFragmentMetadata
  ): EntityMetadata {
    const pkProps = new Set<string>(primaryMeta.primaryKeys ?? []);
    const fragmentProps = new Set<string>(fragment.properties ?? []);

    const columns = primaryMeta.columns.filter(
      (col) => pkProps.has(col.propertyName) || fragmentProps.has(col.propertyName)
    );

    return {
      ...primaryMeta,
      tableName: fragment.tableName,
      columns,
      // Fragments share the same PK, no extra indexes/relationships needed for DML.
      indexes: [],
      relationships: []
    };
  }
}
