import { BatchDeleteOperation } from '../src/batch/BatchDeleteOperation';

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

describe('BatchDeleteOperation', () => {
  let mockProvider: any;
  let op: BatchDeleteOperation;

  beforeEach(() => {
    mockProvider = {
      executeNonQuery: jest.fn().mockResolvedValue(2)
    };
    op = new BatchDeleteOperation(mockProvider);
  });

  it('builds an IN-clause DELETE and returns the provider result', async () => {
    const entities = [
      { id: 1, name: 'A' },
      { id: 2, name: 'B' }
    ];
    const meta = makeMetadata();

    const deleted = await op.execute(entities, meta);

    expect(deleted).toBe(2);
    const [sql, params] = mockProvider.executeNonQuery.mock.calls[0];
    expect(sql).toContain('DELETE FROM users');
    expect(sql).toContain('IN (?, ?)');
    expect(params).toEqual([1, 2]);
  });

  it('returns 0 immediately when entities list is empty', async () => {
    const result = await op.execute([], makeMetadata());
    expect(result).toBe(0);
    expect(mockProvider.executeNonQuery).not.toHaveBeenCalled();
  });

  it('skips entities with null/undefined primary keys', async () => {
    const entities = [
      { id: null, name: 'A' },
      { id: undefined, name: 'B' }
    ];
    const result = await op.execute(entities, makeMetadata());
    expect(result).toBe(0);
    expect(mockProvider.executeNonQuery).not.toHaveBeenCalled();
  });

  it('throws when no primary keys are defined', async () => {
    const meta = makeMetadata({ primaryKeys: undefined });
    await expect(op.execute([{ id: 1 }], meta)).rejects.toThrow('No primary keys defined');
  });

  it('throws when the primary key column is not found in columns', async () => {
    const meta = makeMetadata({ primaryKeys: ['nonExistent'] });
    await expect(op.execute([{ id: 1 }], meta)).rejects.toThrow('No primary key found');
  });
});
