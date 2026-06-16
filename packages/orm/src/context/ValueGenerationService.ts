import type { DatabaseProvider } from '@ts-linq/core';
import type { MetadataRegistry } from '@ts-linq/metadata';
import type { EntityCtorRef } from '@ts-linq/types';

import { HiLoValueGenerator } from '../valueGenerators/HiLoValueGenerator';

/** Minimal shape of a tracked change consumed by value generation. */
type GeneratableChange = { entity: object; entityClass: EntityCtorRef; state: string };

/**
 * Owns client-side value generation for a save operation: Hi-Lo id prefill and
 * default/sentinel-based value generation, plus the per-context Hi-Lo generator
 * cache. Extracted from `DbContext` to isolate value-generation policy from the
 * save pipeline (SRP).
 *
 * @internal
 */
export class ValueGenerationService {
  /** Per-context Hi-Lo generator instances, keyed by "schema.name" or "name". */
  private readonly _hiLoGenerators = new Map<string, HiLoValueGenerator>();

  constructor(
    private readonly registry: MetadataRegistry,
    private readonly provider: DatabaseProvider
  ) {}

  /**
   * Async pre-pass: assigns Hi-Lo IDs to all "added" entities whose PK/FK column
   * declares a sequence with a block size. Reserves blocks in batches per sequence.
   */
  async prefillHiLoIds(changes: ReadonlyArray<GeneratableChange>): Promise<void> {
    for (const change of changes) {
      if (change.state !== 'added') continue;
      const meta = this.registry.getEntity(change.entityClass);
      if (!meta) continue;
      const record = change.entity as Record<string, unknown>;
      for (const col of meta.columns) {
        if (!col.hiLoBlockSize || !col.sequenceName) continue;
        if (record[col.propertyName] !== undefined) continue;
        const key = col.sequenceSchema
          ? `${col.sequenceSchema}.${col.sequenceName}`
          : col.sequenceName;
        let gen = this._hiLoGenerators.get(key);
        if (!gen) {
          const seqName = col.sequenceName;
          const seqSchema = col.sequenceSchema;
          const blockSize = col.hiLoBlockSize;
          const provider = this.provider;
          gen = new HiLoValueGenerator(seqName, seqSchema, blockSize, async (n, s, bs) =>
            provider.nextSequenceValue(n, s, bs)
          );
          this._hiLoGenerators.set(key, gen);
        }
        await gen.ensureBlock();
        record[col.propertyName] = gen.next({
          entityClass: change.entityClass,
          propertyName: col.propertyName
        });
      }
    }
  }

  prefillDefaults(changes: ReadonlyArray<GeneratableChange>): void {
    for (const change of changes) {
      const { state } = change;
      if (state !== 'added' && state !== 'modified') continue;
      const meta = this.registry.getEntity(change.entityClass);
      if (!meta) continue;
      const record = change.entity as Record<string, unknown>;
      for (const col of meta.columns) {
        const policy = col.valueGeneratedPolicy;
        if (!policy) {
          // Legacy defaultValue fill for added entities only
          if (
            state === 'added' &&
            record[col.propertyName] === undefined &&
            col.defaultValue !== undefined
          ) {
            record[col.propertyName] = col.defaultValue;
          }
          continue;
        }

        if (policy === 'Never') continue;
        if (policy === 'OnAdd' && state !== 'added') continue;
        if (policy === 'OnUpdate' && state !== 'modified') continue;
        // OnAddOrUpdate: runs for both

        if (!col.valueGeneratorClass) {
          // DB-side generation — fill defaultValue for added entities only
          if (
            state === 'added' &&
            record[col.propertyName] === undefined &&
            col.defaultValue !== undefined
          ) {
            record[col.propertyName] = col.defaultValue;
          }
          continue;
        }

        // Client-side generator: run when value equals sentinel (or undefined if no sentinel set)
        const currentValue = record[col.propertyName];
        const sentinel = col.sentinel;
        const shouldGenerate =
          sentinel !== undefined ? currentValue === sentinel : currentValue === undefined;

        if (shouldGenerate) {
          const generator = new col.valueGeneratorClass();
          record[col.propertyName] = generator.next({
            entityClass: change.entityClass,
            propertyName: col.propertyName
          });
        }
      }
    }
  }
}
