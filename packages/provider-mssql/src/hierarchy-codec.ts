import { HierarchyId } from '@ts-linq/core';

export function isHierarchyId(value: unknown): value is HierarchyId {
  return HierarchyId.isHierarchyId(value);
}

export function encodeHierarchyId(h: HierarchyId): string {
  return h.toMssqlString();
}

export function decodeHierarchyId(value: string | Buffer): HierarchyId {
  if (typeof value === 'string') {
    return HierarchyId.parse(value);
  }
  // mssql driver may return hierarchyid as Buffer containing UTF-8 text
  return HierarchyId.parse(value.toString('utf8'));
}
