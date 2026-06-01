import { SequenceRegistry } from '@ts-linq/metadata';

import { ModelBuilder } from '../src/ModelBuilder';

// ModelBuilder requires a MetadataRegistry — use a minimal stub
const stubRegistry = {
  getEntity: () => undefined,
  getEntities: () => [],
  addColumn: () => {},
  addIndex: () => {},
  addRelationship: () => {},
  addEntity: () => {},
  registerEntity: () => {}
} as unknown as import('@ts-linq/metadata').MetadataRegistry;

beforeEach(() => {
  SequenceRegistry.reset();
});

describe('ModelBuilder.hasSequence (P1-21)', () => {
  test('returns a SequenceBuilder', () => {
    const mb = new ModelBuilder(stubRegistry);
    const b = mb.hasSequence('OrderNumbers');
    expect(b).toBeDefined();
    expect(typeof b.startsAt).toBe('function');
  });

  test('same builder is returned for the same name', () => {
    const mb = new ModelBuilder(stubRegistry);
    const b1 = mb.hasSequence('seq');
    const b2 = mb.hasSequence('seq');
    expect(b1).toBe(b2);
  });

  test('different keys for same name in different schemas', () => {
    const mb = new ModelBuilder(stubRegistry);
    const b1 = mb.hasSequence('seq', { schema: 'a' });
    const b2 = mb.hasSequence('seq', { schema: 'b' });
    expect(b1).not.toBe(b2);
  });

  test('_getSequences returns declared sequence metadata', () => {
    const mb = new ModelBuilder(stubRegistry);
    mb.hasSequence('OrderNumbers', { schema: 'shared' }).startsAt(1000).incrementsBy(5);
    const seqs = mb._getSequences();
    expect(seqs).toHaveLength(1);
    expect(seqs[0]).toMatchObject({
      name: 'OrderNumbers',
      schema: 'shared',
      startsAt: 1000,
      incrementsBy: 5
    });
  });

  test('sequences are published to SequenceRegistry on _finalize()', () => {
    const mb = new ModelBuilder(stubRegistry);
    mb.hasSequence('Seq1').startsAt(1);
    mb._finalize();
    const all = SequenceRegistry.getAll();
    expect(all.some((s) => s.name === 'Seq1')).toBe(true);
  });
});
