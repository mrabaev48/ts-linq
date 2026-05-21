import { HierarchyId } from '@ts-linq/core';

export function isHierarchyId(value: unknown): value is HierarchyId {
  return HierarchyId.isHierarchyId(value);
}

export function encodeLtree(h: HierarchyId): string {
  return h.toLtreeString();
}

export function decodeLtree(value: string): HierarchyId {
  const trimmed = value.trim();
  if (trimmed === '') return HierarchyId.getRoot();
  // ltree path like "1.2.3" → "/1/2/3/"
  const nodes = trimmed.split('.').map((p) => {
    const n = Number(p);
    if (!Number.isFinite(n)) throw new RangeError(`Invalid ltree segment: "${p}"`);
    return n;
  });
  return HierarchyId.parse(`/${nodes.join('/')}/`);
}
