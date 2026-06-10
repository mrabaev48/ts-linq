import type { EntityMetadata } from '@ts-linq/types';

import { primaryKeyColumnName } from '../support/ColumnResolver';
import type { LoadableRelationship } from '../support/LoadableRelationship';
import type { RelationshipLoadContext, RelationshipLoadStrategy } from './RelationshipLoadStrategy';

const rec = (o: unknown): Record<string, unknown> => o as Record<string, unknown>;

/**
 * Loads `one-to-one` and `many-to-one` relationships (both follow a foreign key
 * on the source entity to a single target row).
 */
export class ToOneStrategy implements RelationshipLoadStrategy {
  public async loadSingle(
    ctx: RelationshipLoadContext,
    entity: unknown,
    _sourceCtor: new () => object,
    _sourceMeta: EntityMetadata,
    relationship: LoadableRelationship
  ): Promise<unknown> {
    const targetCtor = ctx.targetResolver.resolve(relationship.targetEntity);
    const fkName = relationship.foreignKey || ctx.foreignKeys.defaultFor(targetCtor);
    const fkValue = rec(entity)[fkName];
    if (fkValue === undefined || fkValue === null) return null;

    const related = await ctx.fetchToOne(targetCtor, fkValue);
    if (related) ctx.assignSingle(entity, relationship.propertyName, related);
    return related ?? null;
  }

  public async loadBatch(
    ctx: RelationshipLoadContext,
    entities: unknown[],
    _sourceCtor: new () => object,
    sourceMeta: EntityMetadata,
    relationship: LoadableRelationship
  ): Promise<void> {
    const targetCtor = ctx.targetResolver.resolve(relationship.targetEntity);
    const fkName = relationship.foreignKey || ctx.foreignKeys.defaultFor(targetCtor);

    const fkValues = ctx.grouper.uniqueDefined(entities.map((e) => rec(e)[fkName]));
    if (fkValues.length === 0) return;

    const targetPkColumn = primaryKeyColumnName(sourceMeta);
    const related = await ctx.chunker.query(
      ctx.provider,
      targetCtor,
      targetPkColumn,
      fkValues,
      ctx.chunkSize
    );
    const wrapped = ctx.wrapMany(related as object[], targetCtor);

    const targetPk = ctx.metadata.getEntity(targetCtor)?.primaryKeys?.[0];
    if (!targetPk) return;

    const byId = ctx.grouper.indexByKey(wrapped, (rp) => rec(ctx.rawTarget(rp))[targetPk]);

    for (const entity of entities) {
      const fkValue = rec(entity)[fkName];
      if (fkValue === undefined || fkValue === null) continue;
      rec(entity)[relationship.propertyName] = ctx.resolveBatchedToOne(byId.get(fkValue));
      ctx.markLoaded(entity, relationship.propertyName);
    }

    await ctx.recurseBatched(Array.from(byId.values()), targetCtor);
  }
}
