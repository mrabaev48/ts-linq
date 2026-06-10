/**
 * The single audited boundary for reflective entity property access in the
 * loading layer.
 *
 * ORMs unavoidably need dynamic property access (navigation/FK properties are
 * keyed by metadata strings, not statically). Centralizing it here — instead of
 * scattering `(entity as Record<string, unknown>)[key]` punning across the
 * loaders and strategies — keeps the one unavoidable structural cast in a
 * single, named, audited place (refactor core/task-7).
 */
type EntityRecord = Record<string, unknown>;

/** Read a dynamic property off an entity (the audited reflective-read boundary). */
export function getProp(entity: unknown, key: string): unknown {
  return (entity as EntityRecord)[key];
}

/** Write a dynamic property onto an entity (the audited reflective-write boundary). */
export function setProp(entity: unknown, key: string, value: unknown): void {
  (entity as EntityRecord)[key] = value;
}
