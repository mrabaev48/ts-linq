import { createMockProvider, MockDatabaseProvider } from '../src/mocks/MockProvider';

describe('MockDatabaseProvider', () => {
  let mockProvider: MockDatabaseProvider;

  beforeEach(() => {
    mockProvider = new MockDatabaseProvider();
  });

  afterEach(() => {
    mockProvider.reset();
  });

  describe('construction', () => {
    it('should create mock provider', () => {
      expect(mockProvider).toBeInstanceOf(MockDatabaseProvider);
    });

    it('should create using factory function', () => {
      const provider = createMockProvider();

      expect(provider).toBeInstanceOf(MockDatabaseProvider);
    });

    it('should start disconnected', () => {
      expect(mockProvider.isConnected()).toBe(false);
    });
  });

  describe('connect/disconnect', () => {
    it('should connect', async () => {
      await mockProvider.connect();

      expect(mockProvider.isConnected()).toBe(true);
    });

    it('should disconnect', async () => {
      await mockProvider.connect();
      await mockProvider.disconnect();

      expect(mockProvider.isConnected()).toBe(false);
    });
  });

  describe('execute()', () => {
    it('should execute SQL and return empty result by default', async () => {
      const result = await mockProvider.execute('SELECT * FROM users', []);

      expect(result).toEqual([]);
    });

    it('should track executed SQL', async () => {
      await mockProvider.execute('SELECT * FROM users', [1, 2]);

      const executions = mockProvider.getExecutions();
      expect(executions).toHaveLength(1);
      expect(executions[0].sql).toBe('SELECT * FROM users');
      expect(executions[0].params).toEqual([1, 2]);
    });

    it('should return mocked result', async () => {
      const mockData = [{ id: 1, name: 'Alice' }];
      mockProvider.mockResult('SELECT * FROM users', mockData);

      const result = await mockProvider.execute('SELECT * FROM users', []);

      expect(result).toEqual(mockData);
    });

    it('should match exact SQL', async () => {
      mockProvider.mockResult('SELECT * FROM users WHERE id = ?', [{ id: 1 }]);
      mockProvider.mockResult('SELECT * FROM posts', [{ id: 2 }]);

      const result1 = await mockProvider.execute('SELECT * FROM users WHERE id = ?', [1]);
      const result2 = await mockProvider.execute('SELECT * FROM posts', []);

      expect(result1).toEqual([{ id: 1 }]);
      expect(result2).toEqual([{ id: 2 }]);
    });

    it('should use pattern matching for complex SQL', async () => {
      mockProvider.mockResultPattern(/SELECT.*FROM users/, [{ id: 1 }]);

      const result1 = await mockProvider.execute('SELECT * FROM users', []);
      const result2 = await mockProvider.execute('SELECT id, name FROM users WHERE active = ?', [
        true
      ]);

      expect(result1).toEqual([{ id: 1 }]);
      expect(result2).toEqual([{ id: 1 }]);
    });

    it('should prefer exact match over pattern match', async () => {
      mockProvider.mockResult('SELECT * FROM users', [{ exact: true }]);
      mockProvider.mockResultPattern(/SELECT.*FROM users/, [{ pattern: true }]);

      const result = await mockProvider.execute('SELECT * FROM users', []);

      expect(result).toEqual([{ exact: true }]);
    });
  });

  describe('transaction methods', () => {
    it('should track BEGIN TRANSACTION', async () => {
      await mockProvider.beginTransaction();

      const last = mockProvider.getLastExecution();
      expect(last?.sql).toBe('BEGIN TRANSACTION');
    });

    it('should track COMMIT', async () => {
      await mockProvider.commitTransaction();

      const last = mockProvider.getLastExecution();
      expect(last?.sql).toBe('COMMIT');
    });

    it('should track ROLLBACK', async () => {
      await mockProvider.rollbackTransaction();

      const last = mockProvider.getLastExecution();
      expect(last?.sql).toBe('ROLLBACK');
    });
  });

  describe('getExecutions()', () => {
    it('should return all executions', async () => {
      await mockProvider.execute('SELECT * FROM users', []);
      await mockProvider.execute('SELECT * FROM posts', []);

      const executions = mockProvider.getExecutions();

      expect(executions).toHaveLength(2);
      expect(executions[0].sql).toBe('SELECT * FROM users');
      expect(executions[1].sql).toBe('SELECT * FROM posts');
    });

    it('should return copy of executions array', async () => {
      await mockProvider.execute('SELECT * FROM users', []);

      const executions = mockProvider.getExecutions();
      executions.push({ sql: 'fake', params: [], result: [] });

      expect(mockProvider.getExecutions()).toHaveLength(1);
    });
  });

  describe('getLastExecution()', () => {
    it('should return last execution', async () => {
      await mockProvider.execute('SELECT * FROM users', []);
      await mockProvider.execute('SELECT * FROM posts', [1]);

      const last = mockProvider.getLastExecution();

      expect(last?.sql).toBe('SELECT * FROM posts');
      expect(last?.params).toEqual([1]);
    });

    it('should return undefined when no executions', () => {
      const last = mockProvider.getLastExecution();

      expect(last).toBeUndefined();
    });
  });

  describe('clearExecutions()', () => {
    it('should clear execution history', async () => {
      await mockProvider.execute('SELECT * FROM users', []);
      mockProvider.clearExecutions();

      expect(mockProvider.getExecutions()).toHaveLength(0);
      expect(mockProvider.getLastExecution()).toBeUndefined();
    });
  });

  describe('clearMocks()', () => {
    it('should clear mocked results', async () => {
      mockProvider.mockResult('SELECT * FROM users', [{ id: 1 }]);
      mockProvider.clearMocks();

      const result = await mockProvider.execute('SELECT * FROM users', []);

      expect(result).toEqual([]);
    });
  });

  describe('reset()', () => {
    it('should clear executions and mocks', async () => {
      await mockProvider.connect();
      mockProvider.mockResult('SELECT * FROM users', [{ id: 1 }]);
      await mockProvider.execute('SELECT * FROM users', []);

      mockProvider.reset();

      expect(mockProvider.getExecutions()).toHaveLength(0);
      expect(mockProvider.isConnected()).toBe(false);

      const result = await mockProvider.execute('SELECT * FROM users', []);
      expect(result).toEqual([]);
    });
  });

  describe('expectSql()', () => {
    it('should pass when SQL matches', async () => {
      await mockProvider.execute('SELECT * FROM users', []);

      expect(() => mockProvider.expectSql('SELECT * FROM users')).not.toThrow();
    });

    it('should throw when SQL does not match', async () => {
      await mockProvider.execute('SELECT * FROM users', []);

      expect(() => mockProvider.expectSql('SELECT * FROM posts')).toThrow('Expected SQL');
    });

    it('should throw when no SQL executed', () => {
      expect(() => mockProvider.expectSql('SELECT * FROM users')).toThrow('No SQL executed');
    });
  });

  describe('expectParams()', () => {
    it('should pass when params match', async () => {
      await mockProvider.execute('SELECT * FROM users', [1, 'test']);

      expect(() => mockProvider.expectParams([1, 'test'])).not.toThrow();
    });

    it('should throw when params do not match', async () => {
      await mockProvider.execute('SELECT * FROM users', [1]);

      expect(() => mockProvider.expectParams([2])).toThrow('Expected params');
    });

    it('should throw when no SQL executed', () => {
      expect(() => mockProvider.expectParams([1])).toThrow('No SQL executed');
    });
  });

  describe('complex scenarios', () => {
    it('should handle full test workflow', async () => {
      await mockProvider.connect();

      mockProvider.mockResult('SELECT * FROM users WHERE id = ?', [{ id: 1, name: 'Alice' }]);

      await mockProvider.beginTransaction();
      const users = await mockProvider.execute('SELECT * FROM users WHERE id = ?', [1]);
      await mockProvider.execute('UPDATE users SET name = ? WHERE id = ?', ['Bob', 1]);
      await mockProvider.commitTransaction();

      expect(users).toEqual([{ id: 1, name: 'Alice' }]);
      expect(mockProvider.getExecutions()).toHaveLength(4);

      mockProvider.expectSql('COMMIT');

      await mockProvider.disconnect();
    });
  });
});
