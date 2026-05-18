import 'reflect-metadata';

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Column, Entity, PrimaryKey } from '@ts-linq/metadata';

import { DbContext } from '../src/DbContext';
import { TestProvider } from '../tests/stubs/TestProvider';

@Entity()
class ConfigItem {
  @PrimaryKey({ type: 'INTEGER', autoIncrement: true })
  id!: number;

  @Column({ type: 'TEXT' })
  label!: string;
}

class ConfigCtx extends DbContext {}

describe('DbContext constructor — configuration error propagation (ISSUE-011)', () => {
  let provider: TestProvider;

  beforeEach(() => {
    provider = new TestProvider(':memory:');
  });

  it('propagates error thrown by configureSoftDelete', () => {
    jest.spyOn(provider, 'configureSoftDelete').mockImplementation(() => {
      throw new Error('invalid softDeleteColumn: no such column');
    });

    expect(() => new ConfigCtx({ provider })).toThrow('invalid softDeleteColumn: no such column');
  });

  it('propagates error thrown by configureQueryAnalysis', () => {
    jest.spyOn(provider, 'configureQueryAnalysis').mockImplementation(() => {
      throw new Error('invalid analysis config');
    });

    expect(() => new ConfigCtx({ provider, performance: { analysis: { enabled: true } } })).toThrow(
      'invalid analysis config'
    );
  });

  it('constructs successfully with valid options', () => {
    expect(() => new ConfigCtx({ provider })).not.toThrow();
  });

  it('constructs successfully with softDelete options', () => {
    expect(
      () =>
        new ConfigCtx({
          provider,
          softDelete: { enabled: true, column: 'isDeleted' }
        })
    ).not.toThrow();
  });
});
