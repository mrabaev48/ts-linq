import type { AlternateKeyMetadata, IndexMetadata } from '@ts-linq/types';

import type { EntityMetadataState } from './EntityMetadataState';
import { validateIndex } from './validateIndex';

/**
 * Facet store for indexes and alternate (unique) keys. Index registration runs
 * the shared {@link validateIndex} guard for both the finalized and builder
 * states, so the duplicate-name / unknown-column rules live in exactly one place.
 */
export class IndexStore {
  public constructor(private readonly state: EntityMetadataState) {}

  /** Decorator-driven index registration; validated against current columns. */
  public addIndex(target: Function, index: IndexMetadata): void {
    this.state.mutate(
      target,
      (finalized) => {
        validateIndex(index, finalized.indexes, finalized.columns, finalized.tableName);
        finalized.indexes = [...finalized.indexes, index];
      },
      (builder) => {
        const snapshot = builder.build();
        validateIndex(index, snapshot.indexes ?? [], snapshot.columns ?? [], snapshot.tableName);
        builder.addIndex(index);
      }
    );
  }

  /** Fluent index override (fluent wins on conflict via shallow merge). */
  public mergeFluentIndex(target: Function, index: IndexMetadata): void {
    this.state.mutate(
      target,
      (finalized) => {
        const idx = finalized.indexes.findIndex((i) => i.name === index.name);
        if (idx >= 0) {
          finalized.indexes[idx] = { ...finalized.indexes[idx], ...index };
        } else {
          finalized.indexes = [...finalized.indexes, index];
        }
      },
      (builder) => builder.mergeIndex(index)
    );
  }

  /** Merge an alternate key definition (fluent wins on conflict). */
  public mergeFluentAlternateKey(target: Function, ak: AlternateKeyMetadata): void {
    this.state.mutate(
      target,
      (finalized) => {
        finalized.alternateKeys = finalized.alternateKeys ?? [];
        const idx = finalized.alternateKeys.findIndex((k) => k.name === ak.name);
        if (idx >= 0) {
          finalized.alternateKeys[idx] = ak;
        } else {
          finalized.alternateKeys.push(ak);
        }
      },
      (builder) => builder.addAlternateKey(ak)
    );
  }
}
