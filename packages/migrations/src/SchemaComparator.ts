import { diffColumns } from './comparators/ColumnComparator';
import { diffIndexes } from './comparators/IndexComparator';
import type {
  ForeignKeyDef,
  SchemaDiff,
  SchemaSnapshot,
  SeedRowOp,
  SequenceDef,
  SequenceDiff,
  TableDiff,
  TableSnapshot,
  UniqueConstraintDef
} from './DiffTypes';
import { diffSeeds } from './seed/SeedDiff';
import type { ModelSnapshot } from './snapshot/model-snapshot';

function seqKey(s: SequenceDef): string {
  return s.schema ? `${s.schema}.${s.name}` : s.name;
}

function diffSequences(expected: SequenceDef[], actual: SequenceDef[]): SequenceDiff[] {
  const ops: SequenceDiff[] = [];
  const actualMap = new Map(actual.map((s) => [seqKey(s), s]));
  const expectedMap = new Map(expected.map((s) => [seqKey(s), s]));

  for (const exp of expected) {
    const act = actualMap.get(seqKey(exp));
    if (!act) {
      ops.push({ kind: 'create', sequence: exp });
    } else if (sequenceChanged(exp, act)) {
      ops.push({ kind: 'alter', sequence: exp, prev: act });
    }
  }
  for (const act of actual) {
    if (!expectedMap.has(seqKey(act))) {
      ops.push({ kind: 'drop', sequence: act });
    }
  }
  return ops;
}

function sequenceChanged(a: SequenceDef, b: SequenceDef): boolean {
  return (
    a.type !== b.type ||
    a.startsAt !== b.startsAt ||
    a.incrementsBy !== b.incrementsBy ||
    a.minValue !== b.minValue ||
    a.maxValue !== b.maxValue ||
    a.cyclesOn !== b.cyclesOn
  );
}

function fkFingerprint(fk: ForeignKeyDef): string {
  return fk.columns.slice().sort().join(',');
}

function diffForeignKeys(
  expectedTable: TableSnapshot,
  actualTable: TableSnapshot
): { creates: ForeignKeyDef[]; drops: string[] } {
  const expectedFks = expectedTable.foreignKeys ?? [];
  const actualFks = actualTable.foreignKeys ?? [];

  const actualByFingerprint = new Map(actualFks.map((fk) => [fkFingerprint(fk), fk]));
  const expectedByFingerprint = new Map(expectedFks.map((fk) => [fkFingerprint(fk), fk]));

  const creates: ForeignKeyDef[] = [];
  const drops: string[] = [];

  for (const fk of expectedFks) {
    const fp = fkFingerprint(fk);
    const existing = actualByFingerprint.get(fp);
    if (!existing) {
      creates.push(fk);
    } else if (existing.onDelete !== fk.onDelete || existing.refTable !== fk.refTable) {
      // FK changed — drop and recreate.
      if (existing.name) drops.push(existing.name);
      creates.push(fk);
    }
  }

  for (const fk of actualFks) {
    const fp = fkFingerprint(fk);
    if (!expectedByFingerprint.has(fp) && fk.name) {
      drops.push(fk.name);
    }
  }

  return { creates, drops };
}

function diffUniqueConstraints(
  expectedTable: TableSnapshot,
  actualTable: TableSnapshot
): { creates: UniqueConstraintDef[]; drops: string[] } {
  const expected = expectedTable.uniqueConstraints ?? [];
  const actual = actualTable.uniqueConstraints ?? [];
  const expByName = new Map(expected.map((uc) => [uc.name, uc]));
  const actByName = new Map(actual.map((uc) => [uc.name, uc]));
  const creates: UniqueConstraintDef[] = [];
  const drops: string[] = [];
  for (const [name, expUc] of expByName) {
    const actUc = actByName.get(name);
    if (!actUc || actUc.columns.join() !== expUc.columns.join()) {
      if (actUc) drops.push(name);
      creates.push(expUc);
    }
  }
  for (const [name] of actByName) {
    if (!expByName.has(name)) drops.push(name);
  }
  return { creates, drops };
}

function diffExistingTable(
  expectedTable: TableSnapshot,
  actualTable: TableSnapshot
): TableDiff | null {
  const columnChanges = diffColumns(expectedTable, actualTable);
  const { creates: indexCreates, drops: indexDrops } = diffIndexes(expectedTable, actualTable);
  const { creates: fkCreates, drops: fkDrops } = diffForeignKeys(expectedTable, actualTable);
  const { creates: ucCreates, drops: ucDrops } = diffUniqueConstraints(expectedTable, actualTable);
  if (
    columnChanges.length === 0 &&
    indexCreates.length === 0 &&
    indexDrops.length === 0 &&
    fkCreates.length === 0 &&
    fkDrops.length === 0 &&
    ucCreates.length === 0 &&
    ucDrops.length === 0
  ) {
    return null;
  }
  return {
    table: expectedTable.name,
    columnChanges: columnChanges.length ? columnChanges : undefined,
    indexCreates: indexCreates.length ? indexCreates : undefined,
    indexDrops: indexDrops.length ? indexDrops : undefined,
    fkCreates: fkCreates.length ? fkCreates : undefined,
    fkDrops: fkDrops.length ? fkDrops : undefined,
    uniqueConstraintCreates: ucCreates.length ? ucCreates : undefined,
    uniqueConstraintDrops: ucDrops.length ? ucDrops : undefined
  };
}

/**
 * Diffs seed data between two ModelSnapshot versions.
 * Returns the SeedRowOp[] needed to transition from prev to current.
 */
export function compareModelSeeds(prev: ModelSnapshot, current: ModelSnapshot): SeedRowOp[] {
  return diffSeeds(prev.tables, current.tables);
}

export function compareSchemas(expected: SchemaSnapshot, actual: SchemaSnapshot): SchemaDiff {
  const diffs: TableDiff[] = [];
  const actualByName = new Map(actual.tables.map((t) => [t.name, t] as const));

  for (const expectedTable of expected.tables) {
    const actualTable = actualByName.get(expectedTable.name);
    if (!actualTable) {
      diffs.push({ table: expectedTable.name, create: expectedTable });
      continue;
    }
    const diff = diffExistingTable(expectedTable, actualTable);
    if (diff) diffs.push(diff);
  }

  const expectedByName = new Map(expected.tables.map((t) => [t.name, t] as const));
  for (const actualTable of actual.tables) {
    if (!expectedByName.has(actualTable.name)) diffs.push({ table: actualTable.name, drop: true });
  }

  const sequenceOps = diffSequences(expected.sequences ?? [], actual.sequences ?? []);
  return { tables: diffs, ...(sequenceOps.length > 0 ? { sequenceOps } : {}) };
}
