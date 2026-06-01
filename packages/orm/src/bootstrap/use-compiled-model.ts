import type { CompiledModel } from '@ts-linq/metadata';
import type { MetadataRegistry } from '@ts-linq/metadata';
import { loadCompiledModel } from '@ts-linq/metadata';

/** Maps entity class name strings to their constructor functions for compiled-model hydration. */
export type CompiledModelClassMap = Record<string, Function>;

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
