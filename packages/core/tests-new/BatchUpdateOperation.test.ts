import { BatchUpdateOperation } from '../src/batch/BatchUpdateOperation';

function makeMetadata(overrides: Partial<any> = {}): any {
  return {
    tableName: 'users',
    target: class User {},
    columns: [
      { propertyName: 'id', columnName: 'id', isGenerated: false },
      { propertyName: 'name', columnName: 'name', isGenerated: false }
    ],
    primaryKeys: ['id'],
    ...overrides
  };
}

describe('BatchUpdateOperation', () => {
  let mockProvider: any;
  let op: BatchUpdateOperation;

  beforeEach(() => {
    mockProvider = {
      update: jest.fn().mockResolvedValue(undefined),
      updateMany: undefined
    };
    op = new BatchUpdateOperation(mockProvider);
  });

  it('uses provider.updateMany when available and entity count > 1', async () => {
    const entities = [
      { id: 1, name: 'A' },
      { id: 2, name: 'B' }
    ];
    mockProvider.updateMany = jest.fn().mockResolvedValue(entities);
    const meta = makeMetadata();

    const result = await op.execute(entities, meta);

    expect(mockProvider.updateMany).toHaveBeenCalledWith(entities, meta.target);
    expect(result).toBe(entities);
  });

  it('falls back to individual updates when updateMany is not available', async () => {
    const entities = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' }
    ];
    const meta = makeMetadata();

    const result = await op.execute(entities, meta);

    expect(mockProvider.update).toHaveBeenCalledTimes(2);
    expect(result).toEqual(entities);
  });

  it('returns entities unchanged when there are no update columns', async () => {
    const entities = [{ id: 1 }];
    const meta = makeMetadata({
      columns: [{ propertyName: 'id', columnName: 'id', isGenerated: false }]
    });

    const result = await op.execute(entities, meta);

    expect(mockProvider.update).not.toHaveBeenCalled();
    expect(result).toEqual(entities);
  });

  it('throws when no primary keys are defined', async () => {
    const meta = makeMetadata({ primaryKeys: undefined });
    await expect(op.execute([{ id: 1 }], meta)).rejects.toThrow('No primary keys defined');
  });
});
