import { MetadataStorage } from '@ts-linq/metadata';
import type { MetadataSource } from '@ts-linq/types';

/**
 * Resolve the process-wide default {@link MetadataSource} (the global
 * `MetadataStorage` singleton).
 *
 * This is the single, isolated composition-root default used to keep the
 * loading-layer entry points backward compatible. Production code wired through
 * a {@link DbContext} injects an explicit per-context registry instead; relying
 * on this implicit global default defeats multi-tenant / per-context isolation.
 *
 * @deprecated Inject an explicit `MetadataSource` (e.g. the context registry)
 *   into loaders rather than relying on the global singleton default.
 */
export function getDefaultMetadataSource(): MetadataSource {
  return MetadataStorage.getInstance();
}
