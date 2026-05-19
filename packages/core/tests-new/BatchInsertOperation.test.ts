import { BatchInsertOperation } from '../src/batch/BatchInsertOperation';

function makeMetadata(overrides: Partial<any> = {}): any {
  return {
    tableName: 'users',
    target: class User {},
    columns: [
      { propertyName: 'id', columnName: 'id', isGenerated: true },
      { propertyName: 'name', columnName: 'name', isGenerated: false },
      { propertyName: 'email', columnName: 'email', isGenerated: false }
    ],
    primaryKeys: ['id'],
    ...overrides
  };
}

describe('BatchInsertOperation', () => {
  let mockProvider: any;
  let op: BatchInsertOperation;

  beforeEach(() => {
    mockProvider = {
      executeNonQuery: jest.fn().mockResolvedValue(2),
      insertMany: undefined
    };
    op = new BatchInsertOperation(mockProvider);
  });

  it('uses provider.insertMany when available and entity count > 1', async () => {
    const entities = [
      { id: 1, name: 'A', email: 'a@a.com' },
      { id: 2, name: 'B', email: 'b@b.com' }
    ];
    const inserted = [...entities];
    mockProvider.insertMany = jest.fn().mockResolvedValue(inserted);
    const meta = makeMetadata();

    const result = await op.execute(entities, meta);

    expect(mockProvider.insertMany).toHaveBeenCalledWith(entities, meta.target);
    expect(result).toBe(inserted);
  });

  it('falls back to VALUES-clause INSERT when insertMany is not available', async () => {
    const entities = [{ id: undefined, name: 'Alice', email: 'alice@example.com' }];
    const meta = makeMetadata();

    const result = await op.execute(entities, meta);

    expect(mockProvider.executeNonQuery).toHaveBeenCalledTimes(1);
    const [sql, params] = mockProvider.executeNonQuery.mock.calls[0];
    expect(sql).toContain('INSERT INTO users');
    expect(sql).toContain('name');
    expect(sql).toContain('email');
    expect(params).toContain('Alice');
    expect(params).toContain('alice@example.com');
    expect(result).toEqual(entities);
  });

  it('throws when there are no insertable columns', async () => {
    const entities = [{ id: 1 }];
    const meta = makeMetadata({
      columns: [{ propertyName: 'id', columnName: 'id', isGenerated: true }]
    });

    await expect(op.execute(entities, meta)).rejects.toThrow('No insertable columns found');
  });

  it('returns empty array unchanged for empty entity list', async () => {
    const result = await op.execute([], makeMetadata());
    expect(result).toEqual([]);
    expect(mockProvider.executeNonQuery).not.toHaveBeenCalled();
  });
});
