import type { CompiledModel } from '@ts-linq/metadata';
import type { MetadataRegistry } from '@ts-linq/metadata';
import { loadCompiledModel } from '@ts-linq/metadata';
import type { EntityCtor } from '@ts-linq/types';

/** Maps entity class name strings to their constructors for compiled-model hydration. */
export type CompiledModelClassMap = Record<string, EntityCtor>;

/**
 * Pre-populates a MetadataRegistry from an AOT-compiled model snapshot.
 * Called in DbContext constructor before onModelCreating when compiledModel is present.
 */
export function applyCompiledModel(
  model: CompiledModel,
  classMap: CompiledModelClassMap,
  registry: MetadataRegistry
): void {
  loadCompiledModel(model, classMap, registry);
}
