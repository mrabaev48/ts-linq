import type { EntityMetadata } from '@ts-linq/types';

import type { ColumnMapper } from './ColumnMapper';

/**
 * Mutable context handed to every {@link EntityExpander} for a single entity.
 *
 * The context inverts the previous global-registry coupling: the resolved entity
 * lookup map and the shared {@link ColumnMapper} are injected, so expanders never
 * read `MetadataStorage` / `SequenceRegistry` themselves.
 *
 * @typeParam TTable  The snapshot table shape (model vs. schema).
 * @typeParam TColumn The snapshot column shape (model vs. schema).
 */
export interface ExpansionContext<TTable, TColumn> {
  /** The entity currently being expanded. */
  readonly entity: EntityMetadata;
  /**
   * Lookup of all entities being snapshotted, keyed by constructor reference and/or
   * class name (the coordinator decides which keys to populate).
   */
  readonly entityByType: ReadonlyMap<Function | string, EntityMetadata>;
  /**
   * The working column list for the current entity's primary table. Expanders that
   * add columns to the owning table push here.
   */
  readonly columns: TColumn[];
  /**
   * All emitted tables, keyed by table name. Expanders that synthesize additional
   * tables (separate-table owned entities, TPT/TPC subtype tables, join tables,
   * fragment tables) write here.
   */
  readonly tables: Map<string, TTable>;
  /** Shared column projection — the single source of column→snapshot mapping. */
  readonly columnMapper: ColumnMapper;
}

/**
 * Strategy that expands one orthogonal mapping concern (inheritance, owned entities,
 * complex types, shadow properties, fragments, join tables, …) for a single entity.
 *
 * Each expander is independently unit-testable with a hand-built `EntityMetadata`
 * and is composed in a fixed order by the snapshot coordinators (Open/Closed: new
 * mapping rules are added as new expanders without touching existing ones).
 */
export interface EntityExpander<TTable, TColumn> {
  expand(ctx: ExpansionContext<TTable, TColumn>): void;
}
