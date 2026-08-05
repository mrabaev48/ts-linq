import { DialectOptionsBuilder } from '../src';

describe('DialectOptionsBuilder', () => {
  it('omits maxBatchSize entirely when it was never set', () => {
    const opts = new DialectOptionsBuilder().build();

    expect(opts).toEqual({});
    expect('maxBatchSize' in opts).toBe(false);
  });

  it('records maxBatchSize and returns the builder for chaining', () => {
    const builder = new DialectOptionsBuilder();

    expect(builder.maxBatchSize(100)).toBe(builder);
    expect(builder.build()).toEqual({ maxBatchSize: 100 });
  });

  it('keeps the last value when maxBatchSize is set more than once', () => {
    expect(new DialectOptionsBuilder().maxBatchSize(10).maxBatchSize(50).build()).toEqual({
      maxBatchSize: 50
    });
  });

  it('gives each builder instance its own state', () => {
    const a = new DialectOptionsBuilder().maxBatchSize(10);
    const b = new DialectOptionsBuilder();

    expect(a.build()).toEqual({ maxBatchSize: 10 });
    expect(b.build()).toEqual({});
  });

  it('accepts 0 as an explicit value rather than treating it as unset', () => {
    expect(new DialectOptionsBuilder().maxBatchSize(0).build()).toEqual({ maxBatchSize: 0 });
  });
});
