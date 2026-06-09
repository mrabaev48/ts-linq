import type { EntityCtorRef, EntityMetadata, SqlDialect, SqlParameter } from '@ts-linq/types';
import {
  BatchConfigurationError,
  DecoratorUsageError,
  InvalidIncludeError,
  MetadataError,
  OrmError,
  UnsupportedOperationError,
  ValidationError
} from '@ts-linq/types';

import { BatchDeleteOperation } from '../src/batch/BatchDeleteOperation';
import { BatchInsertOperation } from '../src/batch/BatchInsertOperation';
import { BatchOperations } from '../src/batch/BatchOperations';
import { BatchUpdateOperation } from '../src/batch/BatchUpdateOperation';
import { BatchUpsertOperation } from '../src/batch/BatchUpsertOperation';
import { DatabaseProvider } from '../src/DatabaseProvider';
import { CachePolicy } from '../src/decorators/CachePolicy';
import { ValidIf } from '../src/decorators/ValidIf';
import { EntityLoader } from '../src/loading/EntityLoader';
import { IndexOptionsBuilder } from '../src/utils/IndexOptionsBuilder';

// core/task-6: every replaced bare `throw new Error(...)` must now raise the
// mapped typed `OrmError` subclass with its stable `code`. Assertions are on
// `instanceof` + `code` (and `details` where attached) — never on message text.

function expectThrows(fn: () => unknown): unknown {
  let caught: unknown;
  let threw = false;
  try {
    fn();
  } catch (e) {
    threw = true;
    caught = e;
  }
  expect(threw).toBe(true);
  return caught;
}

async function expectRejects(p: Promise<unknown>): Promise<unknown> {
  let caught: unknown;
  let threw = false;
  try {
    await p;
  } catch (e) {
    threw = true;
    caught = e;
  }
  expect(threw).toBe(true);
  return caught;
}

function makeMetadata(overrides: Partial<EntityMetadata> = {}): EntityMetadata {
  return {
    tableName: 'users',
    target: class User {},
    columns: [
      { propertyName: 'id', columnName: 'id', isGenerated: false },
      { propertyName: 'name', columnName: 'name', isGenerated: false }
    ],
    primaryKeys: ['id'],
    ...overrides
  } as unknown as EntityMetadata;
}

describe('core/task-6 typed errors — batch operations', () => {
  it('BatchDeleteOperation raises MetadataError when primary keys are missing', async () => {
    const op = new BatchDeleteOperation({ executeNonQuery: jest.fn() } as never);
    const err = await expectRejects(
      op.execute([{ id: 1 }], makeMetadata({ primaryKeys: undefined }))
    );
    expect(err).toBeInstanceOf(MetadataError);
    expect(err).toBeInstanceOf(OrmError);
    expect((err as MetadataError).code).toBe('METADATA_ERROR');
    expect((err as MetadataError).details).toMatchObject({ entity: 'User' });
  });

  it('BatchDeleteOperation raises MetadataError when no PK column matches', async () => {
    const op = new BatchDeleteOperation({ executeNonQuery: jest.fn() } as never);
    const err = await expectRejects(
      op.execute([{ id: 1 }], makeMetadata({ primaryKeys: ['missing'] }))
    );
    expect(err).toBeInstanceOf(MetadataError);
    expect((err as MetadataError).code).toBe('METADATA_ERROR');
  });

  it('BatchUpdateOperation raises MetadataError when primary keys are missing', async () => {
    const op = new BatchUpdateOperation({} as never);
    const err = await expectRejects(
      op.execute([{ id: 1 }], makeMetadata({ primaryKeys: undefined }))
    );
    expect(err).toBeInstanceOf(MetadataError);
    expect((err as MetadataError).code).toBe('METADATA_ERROR');
  });

  it('BatchUpdateOperation raises MetadataError when target entity is missing', async () => {
    const op = new BatchUpdateOperation({} as never);
    const err = await expectRejects(
      op.execute([{ id: 1, name: 'a' }], makeMetadata({ target: undefined }))
    );
    expect(err).toBeInstanceOf(MetadataError);
    expect((err as MetadataError).code).toBe('METADATA_ERROR');
  });

  it('BatchUpsertOperation raises MetadataError when target entity is missing', async () => {
    const op = new BatchUpsertOperation({} as never);
    const err = await expectRejects(op.execute([{ id: 1 }], makeMetadata({ target: undefined })));
    expect(err).toBeInstanceOf(MetadataError);
    expect((err as MetadataError).code).toBe('METADATA_ERROR');
  });

  it('BatchInsertOperation raises MetadataError when there are no insertable columns', async () => {
    const op = new BatchInsertOperation({} as never);
    const err = await expectRejects(op.execute([{}], makeMetadata()));
    expect(err).toBeInstanceOf(MetadataError);
    expect((err as MetadataError).code).toBe('METADATA_ERROR');
  });

  it('BatchOperations.setDefaultBatchSize raises BatchConfigurationError for non-positive size', () => {
    const ops = new BatchOperations({} as never);
    const err = expectThrows(() => ops.setDefaultBatchSize(0));
    expect(err).toBeInstanceOf(BatchConfigurationError);
    expect((err as BatchConfigurationError).code).toBe('BATCH_CONFIGURATION_ERROR');
    expect((err as BatchConfigurationError).details).toMatchObject({ size: 0 });
  });
});

describe('core/task-6 typed errors — decorator guards', () => {
  it('@ValidIf raises a DecoratorUsageError outside Stage-3 decorators', () => {
    const decorate = ValidIf(() => true) as (t: unknown, c: unknown) => void;
    const err = expectThrows(() => decorate({}, 'legacyProp'));
    expect(err).toBeInstanceOf(DecoratorUsageError);
    expect((err as DecoratorUsageError).code).toBe('DECORATOR_USAGE_ERROR');
    expect((err as DecoratorUsageError).details).toMatchObject({ decorator: '@ValidIf' });
  });

  it('@CachePolicy raises a DecoratorUsageError outside Stage-3 decorators', () => {
    const decorate = CachePolicy({}) as (t: unknown, c?: unknown) => void;
    const err = expectThrows(() => decorate(class X {}, undefined));
    expect(err).toBeInstanceOf(DecoratorUsageError);
    expect((err as DecoratorUsageError).code).toBe('DECORATOR_USAGE_ERROR');
    expect((err as DecoratorUsageError).details).toMatchObject({ decorator: '@CachePolicy' });
  });
});

describe('core/task-6 typed errors — loader / builders / provider', () => {
  it('EntityLoader raises InvalidIncludeError for an unknown include', () => {
    const loader = new EntityLoader({} as never) as unknown as {
      validateIncludes(
        metadata: { relationships: Array<{ propertyName: string }>; target: { name: string } },
        includes?: string[]
      ): void;
    };
    const err = expectThrows(() =>
      loader.validateIncludes(
        { relationships: [{ propertyName: 'tags' }], target: { name: 'Post' } },
        ['bogus']
      )
    );
    expect(err).toBeInstanceOf(InvalidIncludeError);
    expect((err as InvalidIncludeError).code).toBe('INVALID_INCLUDE');
    expect((err as InvalidIncludeError).details).toMatchObject({
      include: 'bogus',
      entity: 'Post'
    });
  });

  it('IndexOptionsBuilder raises ValidationError for a missing name', () => {
    const err = expectThrows(() => new IndexOptionsBuilder('').build());
    expect(err).toBeInstanceOf(ValidationError);
    expect((err as ValidationError).code).toBe('VALIDATION_ERROR');
  });

  it('IndexOptionsBuilder raises ValidationError when no columns are referenced', () => {
    const err = expectThrows(() => new IndexOptionsBuilder('ix_users').build());
    expect(err).toBeInstanceOf(ValidationError);
    expect((err as ValidationError).code).toBe('VALIDATION_ERROR');
  });

  it('DatabaseProvider.nextSequenceValue raises UnsupportedOperationError by default', async () => {
    const provider = new SequenceTestProvider();
    const err = await expectRejects(provider.nextSequenceValue('seq', undefined, 1));
    expect(err).toBeInstanceOf(UnsupportedOperationError);
    expect((err as UnsupportedOperationError).code).toBe('UNSUPPORTED_OPERATION');
    expect((err as UnsupportedOperationError).details).toMatchObject({
      operation: 'nextSequenceValue'
    });
  });
});

/** Minimal concrete provider used only to reach the base `nextSequenceValue`. */
class SequenceTestProvider extends DatabaseProvider {
  constructor() {
    super('test://connection');
  }
  public getDialect(): SqlDialect {
    return {} as SqlDialect;
  }
  protected async doConnect(): Promise<void> {}
  protected async doDisconnect(): Promise<void> {}
  public async createTable(_metadata: EntityMetadata): Promise<void> {}
  public async insert<T extends object>(entity: T, _entityClass: EntityCtorRef): Promise<T> {
    return entity;
  }
  public async update<T extends object>(entity: T, _entityClass: EntityCtorRef): Promise<T> {
    return entity;
  }
  public async delete<T extends object>(_entity: T, _entityClass: EntityCtorRef): Promise<void> {}
  public async findById<T extends object>(): Promise<T | null> {
    return null;
  }
  public async findAll<T extends object>(): Promise<T[]> {
    return [];
  }
  public async findWhere<T extends object>(): Promise<T[]> {
    return [];
  }
  public async findWhereIn<T extends object>(): Promise<T[]> {
    return [];
  }
  protected async doExecuteQuery<T>(_sql: string, _params?: readonly SqlParameter[]): Promise<T[]> {
    return [] as T[];
  }
  protected async doExecuteNonQuery(): Promise<number> {
    return 0;
  }
  protected async doBeginTransaction(): Promise<void> {}
  protected async doCommitTransaction(): Promise<void> {}
  protected async doRollbackTransaction(): Promise<void> {}
}
