import type { IndexDef, TableSnapshot } from '../DiffTypes';

function arraysEqual(a: ReadonlyArray<string>, b: ReadonlyArray<string>): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function shallowObjEqual<T extends Record<string, unknown> | undefined>(a: T, b: T): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  const ak = Object.keys(a);
  const bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  for (const k of ak) {
    if (a[k] !== b[k]) return false;
  }
  return true;
}

export function isIndexEqual(expIdx: IndexDef, actIdx: IndexDef | undefined): boolean {
  if (!actIdx) return false;
  if (!arraysEqual(expIdx.columns, actIdx.columns)) return false;
  if (!!expIdx.unique !== !!actIdx.unique) return false;
  if ((expIdx.where || '') !== ((actIdx as { where?: string }).where || '')) return false;
  const actOrders = (actIdx as { orders?: Record<string, 'ASC' | 'DESC'> }).orders;
  const actCollations = (actIdx as { collations?: Record<string, string> }).collations;
  const actNulls = (actIdx as { nulls?: Record<string, 'FIRST' | 'LAST'> }).nulls;
  const expExpressions = expIdx.expressions || [];
  const actExpressions = (actIdx as { expressions?: string[] }).expressions || [];
  if (!shallowObjEqual(expIdx.orders, actOrders)) return false;
  if (!shallowObjEqual(expIdx.collations, actCollations)) return false;
  if (!shallowObjEqual(expIdx.nulls, actNulls)) return false;
  if (!arraysEqual(expExpressions, actExpressions)) return false;
  return true;
}

export function diffIndexes(
  expectedTable: TableSnapshot,
  actualTable: TableSnapshot
): {
  creates: IndexDef[];
  drops: string[];
} {
  const creates: IndexDef[] = [];
  const drops: string[] = [];
  const expIdxByName = new Map(expectedTable.indexes.map((i) => [i.name, i] as const));
  const actIdxByName = new Map(actualTable.indexes.map((i) => [i.name, i] as const));
  for (const [name, expIdx] of expIdxByName) {
    const actIdx = actIdxByName.get(name);
    const equal = isIndexEqual(expIdx, actIdx);
    if (!actIdx || !equal) {
      if (actIdx && !equal) drops.push(name);
      creates.push(expIdx);
    }
  }
  for (const [name] of actIdxByName) {
    if (!expIdxByName.has(name)) drops.push(name);
  }
  return { creates, drops };
}
