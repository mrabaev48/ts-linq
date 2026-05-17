import { createDatabaseHarness, DatabaseHarness } from '../src/harness/DatabaseHarness';
import type { MockDatabaseProvider } from '../src/mocks/MockProvider';
import { createMockProvider } from '../src/mocks/MockProvider';

class TestEntity {
  id!: number;
  name!: string;
}

class AnotherEntity {
  id!: number;
  value!: string;
}

describe('DatabaseHarness', () => {
  let harness: DatabaseHarness;
  let mockProvider: MockDatabaseProvider;

  beforeEach(() => {
    harness = new DatabaseHarness();
    mockProvider = createMockProvider();
  });

  afterEach(async () => {
    await harness.teardown();
  });

  describe('construction', () => {
    it('should create harness', () => {
      expect(harness).toBeInstanceOf(DatabaseHarness);
    });

    it('should create using factory function', () => {
      const h = createDatabaseHarness();

      expect(h).toBeInstanceOf(DatabaseHarness);
    });
  });

  describe('setup()', () => {
    it('should setup with provider', async () => {
      const provider = await harness.setup({
        provider: mockProvider
      });

      expect(provider).toBe(mockProvider);
    });

    it('should auto-connect by default', async () => {
      const connectSpy = jest.spyOn(mockProvider, 'connect');

      await harness.setup({
        provider: mockProvider
      });

      expect(connectSpy).toHaveBeenCalled();
    });

    it('should not auto-connect when disabled', async () => {
      const connectSpy = jest.spyOn(mockProvider, 'connect');

      await harness.setup({
        provider: mockProvider,
        autoConnect: false
      });

      expect(connectSpy).not.toHaveBeenCalled();
    });
  });

  describe('createSchema()', () => {
    it('should create tables for entities', async () => {
      const executeSpy = jest.spyOn(mockProvider, 'execute');

      await harness.createSchema(mockProvider, [TestEntity]);

      expect(executeSpy).toHaveBeenCalledWith(
        'CREATE TABLE IF EXISTS testentity (id INTEGER PRIMARY KEY)',
        []
      );
    });

    it('should create multiple tables', async () => {
      const executeSpy = jest.spyOn(mockProvider, 'execute');

      await harness.createSchema(mockProvider, [TestEntity, AnotherEntity]);

      expect(executeSpy).toHaveBeenCalledTimes(2);
      expect(executeSpy).toHaveBeenCalledWith(
        'CREATE TABLE IF EXISTS testentity (id INTEGER PRIMARY KEY)',
        []
      );
      expect(executeSpy).toHaveBeenCalledWith(
        'CREATE TABLE IF EXISTS anotherentity (id INTEGER PRIMARY KEY)',
        []
      );
    });

    it('should lowercase table names', async () => {
      class UpperCaseEntity {}
      const executeSpy = jest.spyOn(mockProvider, 'execute');

      await harness.createSchema(mockProvider, [UpperCaseEntity]);

      expect(executeSpy).toHaveBeenCalledWith(
        'CREATE TABLE IF EXISTS uppercaseentity (id INTEGER PRIMARY KEY)',
        []
      );
    });
  });

  describe('dropSchema()', () => {
    it('should drop table for entity', async () => {
      const executeSpy = jest.spyOn(mockProvider, 'execute');

      await harness.dropSchema(mockProvider, [TestEntity]);

      expect(executeSpy).toHaveBeenCalledWith('DROP TABLE IF EXISTS testentity', []);
    });

    it('should drop multiple tables in reverse order', async () => {
      const executeSpy = jest.spyOn(mockProvider, 'execute');

      await harness.dropSchema(mockProvider, [TestEntity, AnotherEntity]);

      expect(executeSpy).toHaveBeenCalledTimes(2);
      const calls = executeSpy.mock.calls;
      expect(calls[0][0]).toBe('DROP TABLE IF EXISTS anotherentity');
      expect(calls[1][0]).toBe('DROP TABLE IF EXISTS testentity');
    });
  });

  describe('seed()', () => {
    it('should insert data into table', async () => {
      const executeSpy = jest.spyOn(mockProvider, 'execute');
      const data = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' }
      ];

      await harness.seed(mockProvider, TestEntity, data);

      expect(executeSpy).toHaveBeenCalledTimes(2);
      expect(executeSpy).toHaveBeenCalledWith('INSERT INTO testentity (id, name) VALUES (?, ?)', [
        1,
        'Alice'
      ]);
      expect(executeSpy).toHaveBeenCalledWith('INSERT INTO testentity (id, name) VALUES (?, ?)', [
        2,
        'Bob'
      ]);
    });

    it('should handle empty data array', async () => {
      const executeSpy = jest.spyOn(mockProvider, 'execute');

      await harness.seed(mockProvider, TestEntity, []);

      expect(executeSpy).not.toHaveBeenCalled();
    });

    it('should handle partial data', async () => {
      const executeSpy = jest.spyOn(mockProvider, 'execute');
      const data = [{ name: 'Alice' }];

      await harness.seed(mockProvider, TestEntity, data);

      expect(executeSpy).toHaveBeenCalledWith('INSERT INTO testentity (name) VALUES (?)', [
        'Alice'
      ]);
    });
  });

  describe('teardown()', () => {
    it('should execute cleanup functions in reverse order', async () => {
      const cleanup1 = jest.fn();
      const cleanup2 = jest.fn();

      await harness.setup({
        provider: mockProvider,
        autoConnect: false
      });

      (harness as any).cleanup.push(cleanup1);
      (harness as any).cleanup.push(cleanup2);

      await harness.teardown();

      expect(cleanup2).toHaveBeenCalled();
      expect(cleanup1).toHaveBeenCalled();
      expect(cleanup2.mock.invocationCallOrder[0]).toBeLessThan(
        cleanup1.mock.invocationCallOrder[0]
      );
    });

    it('should disconnect provider when auto-connected', async () => {
      const disconnectSpy = jest.spyOn(mockProvider, 'disconnect');

      await harness.setup({
        provider: mockProvider
      });

      await harness.teardown();

      expect(disconnectSpy).toHaveBeenCalled();
    });

    it('should clear cleanup list', async () => {
      await harness.setup({
        provider: mockProvider
      });

      await harness.teardown();

      expect((harness as any).cleanup).toEqual([]);
    });

    it('should clear provider reference', async () => {
      await harness.setup({
        provider: mockProvider
      });

      await harness.teardown();

      expect((harness as any).provider).toBeUndefined();
    });
  });

  describe('integration scenarios', () => {
    it('should handle full setup/create/seed/drop/teardown flow', async () => {
      await harness.setup({
        provider: mockProvider
      });

      await harness.createSchema(mockProvider, [TestEntity]);

      await harness.seed(mockProvider, TestEntity, [{ id: 1, name: 'Test' }]);

      await harness.dropSchema(mockProvider, [TestEntity]);

      await harness.teardown();

      expect(mockProvider.isConnected()).toBe(false);
    });
  });
});
