import type { MetadataRegistry } from '@ts-linq/metadata';
import { calcChunkSize, chunkArray } from '@ts-linq/sql-visitor';
import type { EntityCtorRef } from '@ts-linq/types';
import type { EntityMetadata } from '@ts-linq/types';

import type { NormalizedChange } from '../types';

export interface ChangeGroup {
  entityClass: EntityCtorRef;
  metadata: EntityMetadata;
  operation: 'insert' | 'update' | 'delete';
  entities: Record<string, unknown>[];
}

/**
 * Group a flat list of normalized changes into consecutive same-(entityClass + operation) groups.
 * Order is preserved so that inserts, updates, and deletes run in declaration order.
 */
export function groupChanges(
  changes: NormalizedChange[],
  registry: MetadataRegistry
): ChangeGroup[] {
  const groups: ChangeGroup[] = [];
  let lastKey: string | null = null;

  for (const change of changes) {
    const op = stateToOp(change.state);
    if (!op) {
      // Break consecutive grouping — a skipped entry separates adjacent same-(class+op) groups
      lastKey = null;
      continue;
    }

    const key = `${change.entityClass.name}:${op}`;
    const last = groups[groups.length - 1];
    if (last && key === lastKey) {
      last.entities.push(change.entity);
    } else {
      const metadata = registry.getEntity(change.entityClass);
      if (!metadata) {
        throw new Error(
          `BatchGrouper: no metadata for entity ${change.entityClass.name ?? '(unknown)'}`
        );
      }
      groups.push({
        entityClass: change.entityClass,
        metadata,
        operation: op,
        entities: [change.entity]
      });
      lastKey = key;
    }
  }

  return groups;
}

function stateToOp(state: string): 'insert' | 'update' | 'delete' | null {
  switch (state) {
    case 'added':
      return 'insert';
    case 'modified':
      return 'update';
    case 'deleted':
      return 'delete';
    default:
      return null;
  }
}

/**
 * Split a single ChangeGroup into sub-groups each containing at most
 * `calcChunkSize(paramsPerRow, maxBatchSize, paramLimit)` entities.
 */
export function chunkGroup(
  group: ChangeGroup,
  maxBatchSize: number,
  paramLimit: number
): ChangeGroup[] {
  const paramsPerRow = calcParamsPerRow(group);
  const size = calcChunkSize(paramsPerRow, maxBatchSize, paramLimit);
  const entityChunks = chunkArray(group.entities, size);
  return entityChunks.map((entities) => ({ ...group, entities }));
}

function calcParamsPerRow(group: ChangeGroup): number {
  const { metadata, operation } = group;
  if (operation === 'insert') {
    const pks = new Set<string>(metadata.primaryKeys ?? []);
    const firstEntity = group.entities[0] ?? {};
    return metadata.columns.filter((c) => {
      if (c.isComputed) return false;
      const v = firstEntity[c.propertyName];
      // DB-side generated column with no value: skip (IDENTITY/SERIAL/SEQUENCE)
      const isDbSideGenerated =
        (c.isGenerated && !c.valueGeneratorClass) ||
        (c.valueGeneratedPolicy === 'OnAdd' && !c.valueGeneratorClass) ||
        (c.valueGeneratedPolicy === 'OnAddOrUpdate' && !c.valueGeneratorClass);
      if (isDbSideGenerated && (v === null || v === undefined)) return false;
      if (pks.has(c.propertyName) && (v === null || v === undefined)) return false;
      return true;
    }).length;
  }
  if (operation === 'update') {
    const pks = metadata.primaryKeys ?? [];
    const setCols = metadata.columns.filter(
      (c) =>
        !pks.includes(c.propertyName) &&
        !c.isGenerated &&
        !c.isComputed &&
        c.valueGeneratedPolicy !== 'Never'
    );
    return pks.length + setCols.length;
  }
  // delete: one PK param per row
  return 1;
}
