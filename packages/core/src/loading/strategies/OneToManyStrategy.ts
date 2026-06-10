import type { EntityMetadata } from '@ts-linq/types';

import { getProp, setProp } from '../support/EntityRecord';
import type { LoadableRelationship } from '../support/LoadableRelationship';
import type { RelationshipLoadContext, RelationshipLoadStrategy } from './RelationshipLoadStrategy';

/**
 * Loads `one-to-many` relationships (the target rows carry a foreign key back
 * to the source primary key).
 */
export class OneToManyStrategy implements RelationshipLoadStrategy {
  public async loadSingle(
    ctx: RelationshipLoadContext,
    entity: unknown,
    sourceCtor: new () => object,
    sourceMeta: EntityMetadata,
    relationship: LoadableRelationship
  ): Promise<unknown> {
    const parentPk = sourceMeta.primaryKeys?.[0];
    if (!parentPk) return ctx.absentToMany;
    const parentId = getProp(entity, parentPk);
    if (parentId === undefined || parentId === null) return ctx.absentToMany;

    const targetCtor = ctx.targetResolver.resolve(relationship.targetEntity);
    const fkName = relationship.foreignKey || ctx.foreignKeys.defaultFor(sourceCtor);
    const related = await ctx.provider.findWhere(targetCtor, { [fkName]: parentId });
    const wrapped = ctx.wrapMany(related as object[], targetCtor);

    ctx.assignSingle(entity, relationship.propertyName, wrapped);
    return wrapped;
  }

  public async loadBatch(
    ctx: RelationshipLoadContext,
    entities: unknown[],
    sourceCtor: new () => object,
    sourceMeta: EntityMetadata,
    relationship: LoadableRelationship
  ): Promise<void> {
    const parentPk = sourceMeta.primaryKeys?.[0];
    if (!parentPk) return;

    const parentIds = ctx.grouper.uniqueDefined(entities.map((e) => getProp(e, parentPk)));
    if (parentIds.length === 0) return;

    const targetCtor = ctx.targetResolver.resolve(relationship.targetEntity);
    const fkName = relationship.foreignKey || ctx.foreignKeys.defaultFor(sourceCtor);
    const related =
      (await ctx.chunker.query(ctx.provider, targetCtor, fkName, parentIds, ctx.chunkSize)) || [];
    const wrapped = ctx.wrapMany(related as object[], targetCtor);

    const grouped = ctx.grouper.groupByKey(wrapped, (rp) => getProp(ctx.rawTarget(rp), fkName));

    for (const entity of entities) {
      const parentId = getProp(entity, parentPk);
      setProp(entity, relationship.propertyName, grouped.get(parentId) || []);
      ctx.markLoaded(entity, relationship.propertyName);
    }

    await ctx.recurseBatched(related, targetCtor);
  }
}
