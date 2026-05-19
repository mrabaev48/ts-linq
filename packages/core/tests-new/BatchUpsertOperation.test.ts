import { BatchUpsertOperation } from '../src/batch/BatchUpsertOperation';

function makeMetadata(overrides: Partial<any> = {}): any {
  return {
    tableName: 'users',
    target: class User {},
    columns: [{ propertyName: 'id', columnName: 'id' }],
    primaryKeys: ['id'],
    ...overrides
  };
}

describe('BatchUpsertOperation', () => {
  let mockProvider: any;
  let op: BatchUpsertOperation;

  beforeEach(() => {
    mockProvider = {
      upsert: jest.fn().mockImplementation(async (entity: any) => entity),
      upsertMany: undefined
    };
    op = new BatchUpsertOperation(mockProvider);
  });

  it('uses provider.upsertMany when available and entity count > 1', async () => {
    const entities = [{ id: 1 }, { id: 2 }];
    mockProvider.upsertMany = jest.fn().mockResolvedValue(entities);
    const meta = makeMetadata();

    const result = await op.execute(entities, meta);

    expect(mockProvider.upsertMany).toHaveBeenCalledWith(entities, meta.target);
    expect(result).toBe(entities);
  });

  it('falls back to individual upserts when upsertMany is not available', async () => {
    const entities = [{ id: 1 }, { id: 2 }];
    const meta = makeMetadata();

    const result = await op.execute(entities, meta);

    expect(mockProvider.upsert).toHaveBeenCalledTimes(2);
    expect(result).toEqual(entities);
  });

  it('throws when metadata.target is undefined', async () => {
    const meta = makeMetadata({ target: undefined });
    await expect(op.execute([{ id: 1 }], meta)).rejects.toThrow(
      'No target entity defined in metadata'
    );
  });

  it('returns empty array for empty entity list', async () => {
    const result = await op.execute([], makeMetadata());
    expect(result).toEqual([]);
    expect(mockProvider.upsert).not.toHaveBeenCalled();
  });
});
