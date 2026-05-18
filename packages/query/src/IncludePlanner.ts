import type { EntityLoader } from '@ts-linq/core';
import { MetadataStorage, resolveEntityRef } from '@ts-linq/metadata';
import { LoadingStrategy } from '@ts-linq/types';

/** Thrown when an include path cannot be resolved against the registered entity metadata. */
export class IncludeResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IncludeResolutionError';
  }
}

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
    const metadata = MetadataStorage.getEntity(entityClass);
    if (!metadata) {
      throw new IncludeResolutionError(
        `Entity "${entityClass.name}" is not registered in MetadataStorage`
      );
    }

    for (const [propName, nestedPaths] of byFirst) {
      if (nestedPaths.length === 0) continue;

      const rel = metadata.relationships.find((r) => r.propertyName === propName);
      if (!rel) {
        throw new IncludeResolutionError(
          `Entity "${entityClass.name}" has no relationship named "${propName}"`
        );
      }

      const targetCtor = resolveEntityRef(rel.targetEntity);
      if (!targetCtor) continue; // TDZ null — circular import at decoration time, skip

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
