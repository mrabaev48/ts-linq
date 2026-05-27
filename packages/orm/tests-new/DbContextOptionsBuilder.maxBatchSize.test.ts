import 'reflect-metadata';

import { describe, expect, it } from '@jest/globals';
import { DbContextOptionsBuilder } from '@ts-linq/orm';
import { TestProvider } from '@ts-linq/testkits';

describe('DbContextOptionsBuilder.maxBatchSize()', () => {
  it('wires maxBatchSize into build() output', () => {
    const provider = new TestProvider(':memory:');
    const opts = new DbContextOptionsBuilder({ provider }).maxBatchSize(50).build();
    expect((opts as any).maxBatchSize).toBe(50);
  });

  it('defaults to undefined when not configured', () => {
    const provider = new TestProvider(':memory:');
    const opts = new DbContextOptionsBuilder({ provider }).build();
    expect((opts as any).maxBatchSize).toBeUndefined();
  });

  it('supports chaining with other options', () => {
    const provider = new TestProvider(':memory:');
    const opts = new DbContextOptionsBuilder({ provider })
      .maxBatchSize(100)
      .enableSensitiveDataLogging()
      .build();
    expect((opts as any).maxBatchSize).toBe(100);
  });
});
