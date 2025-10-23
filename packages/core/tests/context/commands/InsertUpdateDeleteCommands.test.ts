import { InsertCommand } from '../../../src/context/commands/InsertCommand';
import { UpdateCommand } from '../../../src/context/commands/UpdateCommand';
import { DeleteCommand } from '../../../src/context/commands/DeleteCommand';
import type { DatabaseProvider } from '../../../src/DatabaseProvider';

function providerStub(): jest.Mocked<DatabaseProvider> {
  return {
    providerLabel: 'sqlite',
    connect: jest.fn(async () => {}),
    disconnect: jest.fn(async () => {}),
    beginTransaction: jest.fn(async () => {}),
    commitTransaction: jest.fn(async () => {}),
    rollbackTransaction: jest.fn(async () => {}),
    inTransactionState: false,
    getDialect: jest.fn(),
    executeQuery: jest.fn(),
    executeNonQuery: jest.fn(),
    insert: jest.fn(async () => {}),
    update: jest.fn(async () => {}),
    delete: jest.fn(async () => {}),
    upsert: jest.fn(async () => {})
  } as unknown as jest.Mocked<DatabaseProvider>;
}

describe('Insert/Update/Delete commands', () => {
  class E {}
  const change = { entity: { id: 1 }, entityClass: E, state: 'added' } as any;

  test('InsertCommand calls provider.insert and callback', async () => {
    const provider = providerStub();
    const after = jest.fn();
    const cmd = new InsertCommand(provider, after);
    await cmd.execute(change);
    expect(provider.insert).toHaveBeenCalledWith(change.entity, E);
    expect(after).toHaveBeenCalledWith(change);
  });

  test('UpdateCommand calls provider.update and callback', async () => {
    const provider = providerStub();
    const after = jest.fn();
    const cmd = new UpdateCommand(provider, after);
    await cmd.execute({ ...change, state: 'modified' });
    expect(provider.update).toHaveBeenCalledWith(change.entity, E);
    expect(after).toHaveBeenCalled();
  });

  test('DeleteCommand tries softDelete handler first, then provider.delete', async () => {
    const provider = providerStub();
    const soft = jest.fn(async () => false);
    const after = jest.fn();
    const cmd = new DeleteCommand(provider, soft, after);
    const ok = await cmd.execute({ ...change, state: 'deleted' });
    expect(soft).toHaveBeenCalled();
    expect(provider.delete).toHaveBeenCalledWith(change.entity, E);
    expect(after).toHaveBeenCalled();
    expect(ok).toBe(true);
  });

  test('DeleteCommand returns early when soft delete handled', async () => {
    const provider = providerStub();
    const soft = jest.fn(async () => true);
    const after = jest.fn();
    const cmd = new DeleteCommand(provider, soft, after);
    const ok = await cmd.execute({ ...change, state: 'deleted' });
    expect(provider.delete).not.toHaveBeenCalled();
    expect(after).not.toHaveBeenCalled();
    expect(ok).toBe(true);
  });
});
