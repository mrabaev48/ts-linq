import { MetadataStorage } from '@ts-linq/metadata';
import type { RelationshipMetadata } from '@ts-linq/types';

import type { DatabaseProvider } from '../DatabaseProvider';
import { type LazyLoadingState, markLoaded } from './LazyLoadingState';
import { LAZY_LOADING_STATE, LAZY_LOADING_TARGET } from './LazyLoadingSymbols';

export type ProxyWrapOne = <T extends object>(
  entity: T,
  ctor: new () => T,
  provider: DatabaseProvider
) => T;

export type ProxyWrapMany = <T extends object>(
  entities: T[],
  ctor: new () => T,
  provider: DatabaseProvider
) => T[];

export class RelationshipLoader {
  constructor(
    private readonly provider: DatabaseProvider,
    private readonly wrapOne: ProxyWrapOne,
    private readonly wrapMany: ProxyWrapMany
  ) {}

  async loadSingle<T>(
    entity: T,
    entityClass: new () => T,
    relationship: RelationshipMetadata
  ): Promise<unknown> {
    const metadata = MetadataStorage.getEntity(entityClass);
    if (!metadata) return null;
    if (typeof relationship.targetEntity === 'string') return null;
    if (relationship.targetEntity == null) return null;

    const targetCtor = this.resolveTargetEntity(relationship.targetEntity) as new () => object;

    switch (relationship.type) {
      case 'many-to-one':
      case 'one-to-one': {
        const fk = relationship.foreignKey || this.defaultForeignKeyFor(targetCtor);
        const fkValue = (entity as Record<string, unknown>)[fk];
        if (fkValue === undefined || fkValue === null) return null;
        const related = await this.provider.findById(fkValue, targetCtor);
        return related ? this.wrapOne(related, targetCtor, this.provider) : null;
      }

      case 'one-to-many': {
        const parentPk = metadata.primaryKeys?.[0];
        if (!parentPk) return [];
        const parentId = (entity as Record<string, unknown>)[parentPk];
        if (parentId === undefined || parentId === null) return [];
        const fk = relationship.foreignKey || this.defaultForeignKeyFor(entityClass);
        const related = await this.provider.findWhere(targetCtor, { [fk]: parentId });
        return this.wrapMany(related, targetCtor, this.provider);
      }

      case 'many-to-many':
        return this.loadManyToMany(entity, entityClass, metadata, relationship, targetCtor);

      default:
        return null;
    }
  }

  async loadBatch<T>(
    entities: T[],
    entityClass: new () => T,
    relationship: RelationshipMetadata
  ): Promise<void> {
    if (entities.length === 0) return;
    const metadata = MetadataStorage.getEntity(entityClass);
    if (!metadata) return;
    if (typeof relationship.targetEntity === 'string') return;
    if (relationship.targetEntity == null) return;

    const targetCtor = this.resolveTargetEntity(relationship.targetEntity) as new () => object;

    switch (relationship.type) {
      case 'many-to-one':
      case 'one-to-one':
        await this.batchLoadToOne(entities, relationship, metadata, targetCtor);
        break;
      case 'one-to-many':
        await this.batchLoadOneToMany(entities, entityClass, relationship, metadata, targetCtor);
        break;
      case 'many-to-many':
        await this.batchLoadManyToMany(entities, entityClass, relationship, metadata, targetCtor);
        break;
    }
  }

  private async loadManyToMany<T>(
    entity: T,
    entityClass: new () => T,
    metadata: NonNullable<ReturnType<typeof MetadataStorage.getEntity>>,
    relationship: RelationshipMetadata,
    targetCtor: new () => object
  ): Promise<unknown> {
    const sourcePk = metadata.primaryKeys?.[0];
    const targetPk = (MetadataStorage.getEntity(targetCtor)?.primaryKeys ?? [])[0];
    const through = relationship as RelationshipMetadata & {
      through?: { table: string; sourceFk?: string; targetFk?: string };
    };
    if (!through.through?.table || !sourcePk || !targetPk) return [];

    const jt = through.through.table;
    const sourceFk = through.through.sourceFk || this.defaultForeignKeyFor(entityClass);
    const targetFk = through.through.targetFk || this.defaultForeignKeyFor(targetCtor);
    const sourceId = (entity as Record<string, unknown>)[sourcePk];
    if (sourceId === undefined || sourceId === null) return [];

    const targetIds = await this.fetchTargetIdsFromJunction(jt, sourceFk, targetFk, sourceId);
    if (targetIds.length === 0) return [];

    const targetCol = this.getColumnNameForPk(targetCtor, targetPk);
    const related = await this.provider.findWhereIn(targetCtor, targetCol, targetIds);
    return this.wrapMany(related, targetCtor, this.provider);
  }

  private async batchLoadToOne<T>(
    entities: T[],
    relationship: RelationshipMetadata,
    meta: NonNullable<ReturnType<typeof MetadataStorage.getEntity>>,
    targetCtor: new () => object
  ): Promise<void> {
    const fk = relationship.foreignKey || this.defaultForeignKeyFor(targetCtor);
    const fkValues = entities
      .map((e) => (e as Record<string, unknown>)[fk])
      .filter((v) => v !== undefined && v !== null);
    const uniqueFkValues = Array.from(new Set(fkValues));
    if (uniqueFkValues.length === 0) return;

    const targetPkCol =
      meta.columns.find((c) => c.propertyName === meta.primaryKeys?.[0])?.columnName ||
      meta.primaryKeys?.[0] ||
      'id';
    const related = await this.provider.findWhereIn(targetCtor, targetPkCol, uniqueFkValues);
    const relatedProxies = this.wrapMany(related, targetCtor, this.provider);

    const targetMeta = MetadataStorage.getEntity(targetCtor);
    const targetPk = targetMeta?.primaryKeys?.[0];
    if (!targetPk) return;

    const byId = new Map<unknown, unknown>();
    for (const rp of relatedProxies) {
      const t = this.getRawTarget(rp);
      byId.set((t as Record<string, unknown>)[targetPk], rp);
    }

    for (const entity of entities) {
      const fkVal = (entity as Record<string, unknown>)[fk];
      if (fkVal === undefined || fkVal === null) continue;
      (entity as Record<string, unknown>)[relationship.propertyName] =
        (byId.get(fkVal) as unknown) || null;
      const state = this.getEntityState(entity);
      if (state) markLoaded(state, relationship.propertyName);
    }
  }

  private async batchLoadOneToMany<T>(
    entities: T[],
    entityClass: new () => T,
    relationship: RelationshipMetadata,
    meta: NonNullable<ReturnType<typeof MetadataStorage.getEntity>>,
    targetCtor: new () => object
  ): Promise<void> {
    const parentPk = meta.primaryKeys?.[0];
    if (!parentPk) return;

    const parentIds = entities
      .map((e) => (e as Record<string, unknown>)[parentPk])
      .filter((v) => v !== undefined && v !== null);
    const uniqueParentIds = Array.from(new Set(parentIds));
    if (uniqueParentIds.length === 0) return;

    const fk = relationship.foreignKey || this.defaultForeignKeyFor(entityClass);
    const related = (await this.provider.findWhereIn(targetCtor, fk, uniqueParentIds)) || [];
    const relatedProxies = this.wrapMany(related, targetCtor, this.provider);

    const grouped = new Map<unknown, unknown[]>();
    for (const rp of relatedProxies) {
      const t = this.getRawTarget(rp);
      const key = (t as Record<string, unknown>)[fk];
      const arr = grouped.get(key) || [];
      arr.push(rp);
      grouped.set(key, arr);
    }

    for (const entity of entities) {
      const pid = (entity as Record<string, unknown>)[parentPk];
      (entity as Record<string, unknown>)[relationship.propertyName] = grouped.get(pid) || [];
      const state = this.getEntityState(entity);
      if (state) markLoaded(state, relationship.propertyName);
    }
  }

  private async batchLoadManyToMany<T>(
    entities: T[],
    entityClass: new () => T,
    relationship: RelationshipMetadata,
    meta: NonNullable<ReturnType<typeof MetadataStorage.getEntity>>,
    targetCtor: new () => object
  ): Promise<void> {
    const sourcePk = meta.primaryKeys?.[0];
    if (!sourcePk) return;
    const through = relationship as RelationshipMetadata & {
      through?: { table: string; sourceFk?: string; targetFk?: string };
    };
    if (!through.through?.table) return;
    const targetPk = (MetadataStorage.getEntity(targetCtor)?.primaryKeys || [])[0];
    if (!targetPk) return;

    const jt = through.through.table;
    const sourceFk = through.through.sourceFk || this.defaultForeignKeyFor(entityClass);
    const targetFk = through.through.targetFk || this.defaultForeignKeyFor(targetCtor);

    const sourceIds = this.extractSourceIds(entities, sourcePk);
    if (sourceIds.length === 0) return;

    const { bySource, targetIds } = await this.fetchJunctionMappings(
      jt,
      sourceFk,
      targetFk,
      sourceIds
    );

    if (targetIds.size === 0) {
      for (const entity of entities) {
        (entity as Record<string, unknown>)[relationship.propertyName] = [];
        const state = this.getEntityState(entity);
        if (state) markLoaded(state, relationship.propertyName);
      }
      return;
    }

    const relById = await this.fetchAndMapTargets(targetCtor, targetPk, Array.from(targetIds));
    this.assignManyToManyCollections(
      entities,
      relationship.propertyName,
      sourcePk,
      bySource,
      relById
    );
  }

  private extractSourceIds<T>(entities: T[], sourcePk: string): unknown[] {
    const ids = entities
      .map((e) => (e as Record<string, unknown>)[sourcePk])
      .filter((v) => v !== undefined && v !== null);
    return Array.from(new Set(ids));
  }

  private async fetchJunctionMappings(
    junctionTable: string,
    sourceFk: string,
    targetFk: string,
    sourceIds: unknown[]
  ): Promise<{ bySource: Map<unknown, unknown[]>; targetIds: Set<unknown> }> {
    const rows = await this.provider.executeQuery<{ s: unknown; t: unknown }>(
      `SELECT ${sourceFk} as s, ${targetFk} as t FROM ${junctionTable} WHERE ${sourceFk} IN (${sourceIds
        .map(() => '?')
        .join(',')})`,
      sourceIds as Array<string | number | boolean | Date | null>
    );
    const bySource = new Map<unknown, unknown[]>();
    const targetIds = new Set<unknown>();
    for (const r of rows) {
      targetIds.add(r.t);
      const arr = bySource.get(r.s) || [];
      arr.push(r.t);
      bySource.set(r.s, arr);
    }
    return { bySource, targetIds };
  }

  private async fetchTargetIdsFromJunction(
    junctionTable: string,
    sourceFk: string,
    targetFk: string,
    sourceId: unknown
  ): Promise<unknown[]> {
    const rows = await this.provider.executeQuery<{ id: unknown }>(
      `SELECT ${targetFk} as id FROM ${junctionTable} WHERE ${sourceFk} = ?`,
      [sourceId as string | number | boolean | Date | null]
    );
    return rows.map((r) => r.id).filter((v) => v !== undefined && v !== null);
  }

  private async fetchAndMapTargets(
    targetCtor: new () => object,
    targetPk: string,
    targetIds: unknown[]
  ): Promise<Map<unknown, unknown>> {
    const targetCol = this.getColumnNameForPk(targetCtor, targetPk);
    const related = await this.provider.findWhereIn(targetCtor, targetCol, targetIds);
    const relProxies = this.wrapMany(related, targetCtor, this.provider);
    const relById = new Map<unknown, unknown>();
    for (const rp of relProxies) {
      const t = this.getRawTarget(rp);
      relById.set((t as Record<string, unknown>)[targetPk], rp);
    }
    return relById;
  }

  private assignManyToManyCollections<T>(
    entities: T[],
    propName: string,
    sourcePk: string,
    bySource: Map<unknown, unknown[]>,
    relById: Map<unknown, unknown>
  ): void {
    for (const entity of entities) {
      const sid = (entity as Record<string, unknown>)[sourcePk];
      const idList = (bySource.get(sid) as unknown[]) || [];
      (entity as Record<string, unknown>)[propName] = idList
        .map((id) => relById.get(id))
        .filter(Boolean);
      const state = this.getEntityState(entity);
      if (state) markLoaded(state, propName);
    }
  }

  private getColumnNameForPk(targetCtor: new () => object, targetPk: string): string {
    return (
      (MetadataStorage.getEntity(targetCtor)?.columns || []).find(
        (c) => c.propertyName === targetPk
      )?.columnName || targetPk
    );
  }

  private resolveTargetEntity(target: Function | (() => Function)): Function {
    const maybeCtor = target as { prototype?: unknown } | (() => Function);
    if (typeof maybeCtor === 'function' && 'prototype' in maybeCtor && maybeCtor.prototype) {
      return maybeCtor as Function;
    }
    return (target as () => Function)();
  }

  private defaultForeignKeyFor(type: Function): string {
    const name = type.name || 'id';
    const camel = name.charAt(0).toLowerCase() + name.slice(1);
    return `${camel}Id`;
  }

  private getEntityState(entity: unknown): LazyLoadingState | null {
    return (entity as Record<symbol, unknown>)[LAZY_LOADING_STATE] as LazyLoadingState | null;
  }

  private getRawTarget<T>(entity: T): T {
    const target = (entity as Record<symbol, unknown>)[LAZY_LOADING_TARGET];
    return target !== undefined ? (target as T) : entity;
  }
}
