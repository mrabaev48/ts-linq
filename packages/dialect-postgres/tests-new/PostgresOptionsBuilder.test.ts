import { DialectOptionsBuilder } from '@ts-linq/dialect-kit';

import { PostgresOptionsBuilder } from '../src/PostgresOptionsBuilder';

// The behaviour itself is covered by dialect-kit's DialectOptionsBuilder suite; this asserts the
// per-dialect name stayed a real, constructible alias of that single implementation.
describe('PostgresOptionsBuilder', () => {
  it('is an alias of the shared DialectOptionsBuilder', () => {
    expect(new PostgresOptionsBuilder()).toBeInstanceOf(DialectOptionsBuilder);
  });

  it('inherits the fluent maxBatchSize behaviour', () => {
    const builder = new PostgresOptionsBuilder();

    expect(builder.maxBatchSize(100)).toBe(builder);
    expect(builder.build()).toEqual({ maxBatchSize: 100 });
    expect(new PostgresOptionsBuilder().build()).toEqual({});
  });
});
