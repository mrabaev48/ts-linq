import { BatchExecutor } from '../../src/batch/BatchExecutor';
import type { DatabaseProvider } from '../../src/DatabaseProvider';

function createProviderStub(): jest.Mocked<DatabaseProvider> {
  return {
    // minimal surface for BatchExecutor
    beginTransaction: jest.fn(async () => {}),
    commitTransaction: jest.fn(async () => {}),
    rollbackTransaction: jest.fn(async () => {}),
    inTransactionState: false,
    // unused in these tests
    connect: jest.fn(async () => {}),
    disconnect: jest.fn(async () => {}),
    getDialect: jest.fn(),
    executeQuery: jest.fn(),
    executeNonQuery: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    upsert: jest.fn(),
    insertMany: undefined,
    updateMany: undefined,
    upsertMany: undefined,
    providerLabel: 'sqlite'
  } as unknown as jest.Mocked<DatabaseProvider>;
}

describe('BatchExecutor.inTxn', () => {
  test('wraps fn with begin/commit when useTransactions=true and not already in transaction', async () => {
    const provider = createProviderStub();
    const exec = new BatchExecutor(provider);
    const fn = jest.fn(async () => 42);

    const result = await exec.inTxn(true, fn);

    expect(provider.beginTransaction).toHaveBeenCalledTimes(1);
    expect(provider.commitTransaction).toHaveBeenCalledTimes(1);
    expect(provider.rollbackTransaction).not.toHaveBeenCalled();
    expect(result).toBe(42);
  });

  test('rolls back on error when useTransactions=true and inTransactionState becomes true', async () => {
    const provider = createProviderStub();
    const exec = new BatchExecutor(provider);
    const error = new Error('boom');
    const fn = jest.fn(async () => {
      // emulate provider marking state after begin
      provider.inTransactionState = true;
      throw error;
    });

    await expect(exec.inTxn(true, fn)).rejects.toThrow('boom');
    expect(provider.beginTransaction).toHaveBeenCalledTimes(1);
    expect(provider.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(provider.commitTransaction).not.toHaveBeenCalled();
  });

  test('does not open transaction when useTransactions=false', async () => {
    const provider = createProviderStub();
    const exec = new BatchExecutor(provider);
    const fn = jest.fn(async () => 'ok');

    const result = await exec.inTxn(false, fn);

    expect(provider.beginTransaction).not.toHaveBeenCalled();
    expect(provider.commitTransaction).not.toHaveBeenCalled();
    expect(provider.rollbackTransaction).not.toHaveBeenCalled();
    expect(result).toBe('ok');
  });
});
