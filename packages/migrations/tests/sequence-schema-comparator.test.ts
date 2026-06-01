import type { SchemaSnapshot } from '../src/DiffTypes';
import { compareSchemas } from '../src/SchemaComparator';

const emptySnapshot: SchemaSnapshot = { tables: [] };

describe('compareSchemas — sequence diffing (P1-21)', () => {
  test('creates sequence that exists in expected but not in actual', () => {
    const expected: SchemaSnapshot = {
      tables: [],
      sequences: [{ name: 'Seq', schema: 'dbo', startsAt: 1, incrementsBy: 1 }]
    };
    const diff = compareSchemas(expected, emptySnapshot);
    expect(diff.sequenceOps).toHaveLength(1);
    expect(diff.sequenceOps![0].kind).toBe('create');
    expect(diff.sequenceOps![0].sequence.name).toBe('Seq');
  });

  test('drops sequence that exists in actual but not in expected', () => {
    const actual: SchemaSnapshot = {
      tables: [],
      sequences: [{ name: 'OldSeq' }]
    };
    const diff = compareSchemas(emptySnapshot, actual);
    expect(diff.sequenceOps).toHaveLength(1);
    expect(diff.sequenceOps![0].kind).toBe('drop');
  });

  test('alters sequence when parameters change', () => {
    const expected: SchemaSnapshot = {
      tables: [],
      sequences: [{ name: 'Seq', incrementsBy: 10 }]
    };
    const actual: SchemaSnapshot = {
      tables: [],
      sequences: [{ name: 'Seq', incrementsBy: 1 }]
    };
    const diff = compareSchemas(expected, actual);
    expect(diff.sequenceOps).toHaveLength(1);
    expect(diff.sequenceOps![0].kind).toBe('alter');
    expect(diff.sequenceOps![0].sequence.incrementsBy).toBe(10);
    expect(diff.sequenceOps![0].prev!.incrementsBy).toBe(1);
  });

  test('no ops when sequences are identical', () => {
    const snap: SchemaSnapshot = {
      tables: [],
      sequences: [{ name: 'Seq', startsAt: 1, incrementsBy: 1 }]
    };
    const diff = compareSchemas(snap, snap);
    expect(diff.sequenceOps ?? []).toHaveLength(0);
  });

  test('no sequenceOps when both snapshots have no sequences', () => {
    const diff = compareSchemas(emptySnapshot, emptySnapshot);
    expect(diff.sequenceOps).toBeUndefined();
  });

  test('schema is part of the key — same name in different schemas treated separately', () => {
    const expected: SchemaSnapshot = {
      tables: [],
      sequences: [{ name: 'seq', schema: 'a' }]
    };
    const actual: SchemaSnapshot = {
      tables: [],
      sequences: [{ name: 'seq', schema: 'b' }]
    };
    const diff = compareSchemas(expected, actual);
    expect(diff.sequenceOps).toHaveLength(2); // create 'a.seq', drop 'b.seq'
  });
});
