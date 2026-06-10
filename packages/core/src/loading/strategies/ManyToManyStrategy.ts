import type { EntityMetadata, SqlParameter } from '@ts-linq/types';

import type { DatabaseProvider } from '../../DatabaseProvider';
import { columnNameForProperty } from '../support/ColumnResolver';
import { getProp, setProp } from '../support/EntityRecord';
import type { LoadableRelationship, ThroughMapping } from '../support/LoadableRelationship';
import type { RelationshipLoadContext, RelationshipLoadStrategy } from './RelationshipLoadStrategy';

/**
 * Loads `many-to-many` relationships through a junction table. Junction reads
 * go exclusively through {@link DatabaseProvider.queryJunction} (parameterized
 * + dialect-quoted, per core/task-4) — never raw SQL.
 */
export class ManyToManyStrategy implements RelationshipLoadStrategy {
  public async loadSingle(
    ctx: RelationshipLoadContext,
    entity: unknown,
    sourceCtor: new () => object,
    sourceMeta: EntityMetadata,
    relationship: LoadableRelationship
  ): Promise<unknown> {
    const sourcePk = sourceMeta.primaryKeys?.[0];
    const targetCtor = ctx.targetResolver.resolve(relationship.targetEntity);
    const targetPk = ctx.metadata.getEntity(targetCtor)?.primaryKeys?.[0];
    const through = relationship.through;
    if (!through?.table || !sourcePk || !targetPk) return ctx.absentToMany;

    const { sourceFk, targetFk } = this.resolveJunctionKeys(ctx, through, sourceCtor, targetCtor);
    const sourceId = getProp(entity, sourcePk);
    if (sourceId === undefined || sourceId === null) return ctx.absentToMany;

    const targetIds = await this.fetchTargetIds(ctx.provider, through.table, sourceFk, targetFk, [
      sourceId
    ]);
    if (targetIds.length === 0) return ctx.absentToMany;

    const targetCol = columnNameForProperty(ctx.metadata.getEntity(targetCtor), targetPk);
    const related = await ctx.provider.findWhereIn(targetCtor, targetCol, targetIds);
    const wrapped = ctx.wrapMany(related, targetCtor);

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
    const sourcePk = sourceMeta.primaryKeys?.[0];
    if (!sourcePk) return;
    const through = relationship.through;
    if (!through?.table) return;
    const targetCtor = ctx.targetResolver.resolve(relationship.targetEntity);
    const targetPk = ctx.metadata.getEntity(targetCtor)?.primaryKeys?.[0];
    if (!targetPk) return;

    const { sourceFk, targetFk } = this.resolveJunctionKeys(ctx, through, sourceCtor, targetCtor);

    const sourceIds = ctx.grouper.uniqueDefined(entities.map((e) => getProp(e, sourcePk)));
    if (sourceIds.length === 0) return;

    const { bySource, targetIds } = await this.fetchJunctionMappings(
      ctx.provider,
      through.table,
      sourceFk,
      targetFk,
      sourceIds
    );

    const propertyName = relationship.propertyName;
    if (targetIds.size === 0) {
      for (const entity of entities) {
        setProp(entity, propertyName, []);
        ctx.markLoaded(entity, propertyName);
      }
      return;
    }

    const relById = await this.fetchAndMapTargets(ctx, targetCtor, targetPk, Array.from(targetIds));

    for (const entity of entities) {
      const sourceId = getProp(entity, sourcePk);
      const idList = bySource.get(sourceId) || [];
      setProp(entity, propertyName, idList.map((id) => relById.get(id)).filter(Boolean));
      ctx.markLoaded(entity, propertyName);
    }

    await ctx.recurseBatched(Array.from(relById.values()), targetCtor);
  }

  private resolveJunctionKeys(
    ctx: RelationshipLoadContext,
    through: ThroughMapping,
    sourceCtor: new () => object,
    targetCtor: new () => object
  ): { sourceFk: string; targetFk: string } {
    return {
      sourceFk: through.sourceFk || ctx.foreignKeys.defaultFor(sourceCtor),
      targetFk: through.targetFk || ctx.foreignKeys.defaultFor(targetCtor)
    };
  }

  private async fetchTargetIds(
    provider: DatabaseProvider,
    junctionTable: string,
    sourceFk: string,
    targetFk: string,
    sourceIds: unknown[]
  ): Promise<unknown[]> {
    const rows = await provider.queryJunction({
      table: junctionTable,
      selectColumns: [targetFk],
      whereColumn: sourceFk,
      whereValues: sourceIds as SqlParameter[]
    });
    return rows.map((r) => r[targetFk]).filter((v) => v !== undefined && v !== null);
  }

  private async fetchJunctionMappings(
    provider: DatabaseProvider,
    junctionTable: string,
    sourceFk: string,
    targetFk: string,
    sourceIds: unknown[]
  ): Promise<{ bySource: Map<unknown, unknown[]>; targetIds: Set<unknown> }> {
    const rows = await provider.queryJunction({
      table: junctionTable,
      selectColumns: [sourceFk, targetFk],
      whereColumn: sourceFk,
      whereValues: sourceIds as SqlParameter[]
    });
    const bySource = new Map<unknown, unknown[]>();
    const targetIds = new Set<unknown>();
    for (const row of rows) {
      const s = row[sourceFk];
      const t = row[targetFk];
      targetIds.add(t);
      const bucket = bySource.get(s) || [];
      bucket.push(t);
      bySource.set(s, bucket);
    }
    return { bySource, targetIds };
  }

  private async fetchAndMapTargets(
    ctx: RelationshipLoadContext,
    targetCtor: new () => object,
    targetPk: string,
    targetIds: unknown[]
  ): Promise<Map<unknown, unknown>> {
    const targetCol = columnNameForProperty(ctx.metadata.getEntity(targetCtor), targetPk);
    const related = await ctx.provider.findWhereIn(targetCtor, targetCol, targetIds);
    const wrapped = ctx.wrapMany(related, targetCtor);
    return ctx.grouper.indexByKey(wrapped, (rp) => getProp(ctx.rawTarget(rp), targetPk));
  }
}
