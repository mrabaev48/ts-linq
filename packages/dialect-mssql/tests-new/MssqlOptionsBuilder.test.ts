import { DialectOptionsBuilder } from '@ts-linq/dialect-kit';

import { MssqlOptionsBuilder } from '../src/MssqlOptionsBuilder';

// The behaviour itself is covered by dialect-kit's DialectOptionsBuilder suite; this asserts the
// per-dialect name stayed a real, constructible alias of that single implementation.
describe('MssqlOptionsBuilder', () => {
  it('is an alias of the shared DialectOptionsBuilder', () => {
    expect(new MssqlOptionsBuilder()).toBeInstanceOf(DialectOptionsBuilder);
  });

  it('inherits the fluent maxBatchSize behaviour', () => {
    const builder = new MssqlOptionsBuilder();

    expect(builder.maxBatchSize(50)).toBe(builder);
    expect(builder.build()).toEqual({ maxBatchSize: 50 });
    expect(new MssqlOptionsBuilder().build()).toEqual({});
  });
});
