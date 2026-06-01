import { SequenceBuilder } from '../src/builders/SequenceBuilder';

describe('SequenceBuilder (P1-21)', () => {
  it('builds metadata with name only', () => {
    const b = new SequenceBuilder('OrderNumbers');
    const meta = b._getMeta();
    expect(meta.name).toBe('OrderNumbers');
    expect(meta.schema).toBeUndefined();
    expect(meta.type).toBe('int');
  });

  it('accepts schema and type options', () => {
    const b = new SequenceBuilder('CustomerHiLo', { schema: 'shared', type: 'bigint' });
    const meta = b._getMeta();
    expect(meta.schema).toBe('shared');
    expect(meta.type).toBe('bigint');
  });

  it('startsAt sets the start value', () => {
    const b = new SequenceBuilder('Seq').startsAt(1000);
    expect(b._getMeta().startsAt).toBe(1000);
  });

  it('incrementsBy sets the step', () => {
    const b = new SequenceBuilder('Seq').incrementsBy(5);
    expect(b._getMeta().incrementsBy).toBe(5);
  });

  it('minValue and maxValue are stored', () => {
    const b = new SequenceBuilder('Seq').minValue(1).maxValue(9999);
    const meta = b._getMeta();
    expect(meta.minValue).toBe(1);
    expect(meta.maxValue).toBe(9999);
  });

  it('cyclesOn sets the flag', () => {
    const b = new SequenceBuilder('Seq').cyclesOn();
    expect(b._getMeta().cyclesOn).toBe(true);
  });

  it('all fluent methods return the same builder instance', () => {
    const b = new SequenceBuilder('Seq');
    expect(b.startsAt(1)).toBe(b);
    expect(b.incrementsBy(1)).toBe(b);
    expect(b.minValue(1)).toBe(b);
    expect(b.maxValue(999)).toBe(b);
    expect(b.cyclesOn()).toBe(b);
  });
});
