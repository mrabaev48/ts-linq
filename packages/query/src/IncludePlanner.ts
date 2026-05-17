import type { EntityLoader } from '@ts-linq/core';
import { MetadataStorage } from '@ts-linq/metadata';
import { LoadingStrategy } from '@ts-linq/types';

export class IncludePlanner<T> {
  constructor(
    private readonly entityLoader: EntityLoader | undefined,
    private readonly entityClass: new () => T
  ) {}

  public async populateIncludes(entities: T[], includes: string[], limit?: number): Promise<void> {
    if (!this.entityLoader || includes.length === 0 || limit === 1) return;
    await this.loadLevel(entities, this.entityClass as new () => unknown, includes);
  }

  private async loadLevel(
    entities: unknown[],
    entityClass: new () => unknown,
    includes: string[]
  ): Promise<void> {
    if (entities.length === 0 || includes.length === 0) return;

    // Group includes by their first path segment
    const byFirst = new Map<string, string[]>();
    for (const inc of includes) {
      const dotIdx = inc.indexOf('.');
      const first = dotIdx === -1 ? inc : inc.slice(0, dotIdx);
      const rest = dotIdx === -1 ? null : inc.slice(dotIdx + 1);
      if (!byFirst.has(first)) byFirst.set(first, []);
      if (rest) byFirst.get(first)!.push(rest);
    }

    const topLevelKeys = [...byFirst.keys()];

    await this.entityLoader!.populateRelationshipsMany(
      entities as T[],
      entityClass as new () => T,
      {
        strategy: LoadingStrategy.Eager,
        includes: topLevelKeys,
        depth: 1
      }
    );

    // Recursively load nested includes for each navigation property
    const metadata = MetadataStorage.getEntity(entityClass as new () => unknown);
    for (const [propName, nestedPaths] of byFirst) {
      if (nestedPaths.length === 0) continue;

      const rel = metadata?.relationships.find((r) => r.propertyName === propName);
      if (!rel) continue;

      const targetCtor = resolveTargetCtor(rel.targetEntity);
      if (!targetCtor) continue;

      const navEntities: unknown[] = [];
      for (const entity of entities) {
        const nav = (entity as Record<string, unknown>)[propName];
        if (Array.isArray(nav)) navEntities.push(...nav);
        else if (nav != null) navEntities.push(nav);
      }

      if (navEntities.length > 0) {
        await this.loadLevel(navEntities, targetCtor, nestedPaths);
      }
    }
  }
}

function resolveTargetCtor(
  target: string | Function | (() => Function)
): (new () => unknown) | null {
  if (typeof target === 'string') return null;
  if (typeof target === 'function') {
    if ('prototype' in target && (target as { prototype?: unknown }).prototype) {
      return target as new () => unknown;
    }
    try {
      const resolved = (target as () => Function)();
      return resolved as new () => unknown;
    } catch {
      return null;
    }
  }
  return null;
}
