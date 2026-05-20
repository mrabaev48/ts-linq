import * as types from '../src/index';

describe('Type Exports', () => {
  it('should export all error classes', () => {
    expect(types.DatabaseError).toBeDefined();
    expect(types.OptimisticConcurrencyError).toBeDefined();
    expect(types.UniqueConstraintError).toBeDefined();
    expect(types.ForeignKeyConstraintError).toBeDefined();
    expect(types.ValidationError).toBeDefined();
  });

  it('should export Result helper functions', () => {
    expect(typeof types.ok).toBe('function');
    expect(typeof types.err).toBe('function');
  });

  it('should export LoadingStrategy enum', () => {
    expect(types.LoadingStrategy).toBeDefined();
    expect(types.LoadingStrategy.Lazy).toBe('lazy');
    expect(types.LoadingStrategy.Eager).toBe('eager');
    expect(types.LoadingStrategy.Explicit).toBe('explicit');
  });

  it('should export EntityState enum', () => {
    expect(types.EntityState).toBeDefined();
    expect(types.EntityState.Unchanged).toBe('unchanged');
    expect(types.EntityState.Added).toBe('added');
    expect(types.EntityState.Modified).toBe('modified');
    expect(types.EntityState.Deleted).toBe('deleted');
  });

  it('should not export any unexpected runtime values', () => {
    const exportedKeys = Object.keys(types);
    const expectedExports = [
      'DatabaseError',
      'OptimisticConcurrencyError',
      'UniqueConstraintError',
      'ForeignKeyConstraintError',
      'ValidationError',
      'ok',
      'err',
      'LoadingStrategy',
      'EntityState',
      'DeleteBehavior',
      'QuerySplittingBehavior'
    ];

    expect(exportedKeys.sort()).toEqual(expectedExports.sort());
  });

  describe('Type-only exports (compile-time validation)', () => {
    it('should allow SqlParameter type usage', () => {
      const param1: types.SqlParameter = 'test';
      const param2: types.SqlParameter = 123;
      const param3: types.SqlParameter = true;
      const param4: types.SqlParameter = new Date();
      const param5: types.SqlParameter = new Uint8Array([1, 2, 3]);
      const param6: types.SqlParameter = null;

      expect(param1).toBe('test');
      expect(param2).toBe(123);
      expect(param3).toBe(true);
      expect(param4).toBeInstanceOf(Date);
      expect(param5).toBeInstanceOf(Uint8Array);
      expect(param6).toBe(null);
    });

    it('should allow Result type usage', () => {
      const successResult: types.Result<number> = { success: true, value: 42 };
      const errorResult: types.Result<number, string> = { success: false, error: 'failed' };

      expect(successResult.success).toBe(true);
      expect(errorResult.success).toBe(false);
    });

    it('should allow QueryOptions type usage', () => {
      const options: types.QueryOptions = {
        select: ['id', 'name'],
        where: { condition: 'id = ?', parameters: [1] },
        orderBy: [{ column: 'name', direction: 'ASC' }],
        limit: 10,
        offset: 0
      };

      expect(options.select).toEqual(['id', 'name']);
      expect(options.limit).toBe(10);
    });

    it('should allow Logger interface usage', () => {
      const logger: types.Logger = {
        debug: (msg) => {},
        info: (msg) => {},
        warn: (msg) => {},
        error: (msg) => {}
      };

      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
    });

    it('should allow ColumnMetadata type usage', () => {
      const column: types.ColumnMetadata = {
        propertyName: 'id',
        columnName: 'id',
        type: 'INTEGER',
        primaryKey: true,
        nullable: false
      };

      expect(column.propertyName).toBe('id');
      expect(column.primaryKey).toBe(true);
    });
  });
});
