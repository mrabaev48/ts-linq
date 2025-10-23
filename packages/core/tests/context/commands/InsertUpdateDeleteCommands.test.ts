import { InsertCommand } from '../../../src/context/commands/InsertCommand';
import { UpdateCommand } from '../../../src/context/commands/UpdateCommand';
import { DeleteCommand } from '../../../src/context/commands/DeleteCommand';
import type { DatabaseProvider } from '../../../src/DatabaseProvider';

function providerStub(): jest.Mocked<DatabaseProvider> {
  return {
    providerLabel: 'sqlite',
    connect: vi.fn(async () => {}),
    disconnect: vi.fn(async () => {}),
    beginTransaction: vi.fn(async () => {}),
    commitTransaction: vi.fn(async () => {}),
    rollbackTransaction: vi.fn(async () => {}),
    inTransactionState: false,
    getDialect: vi.fn(),
    executeQuery: vi.fn(),
    executeNonQuery: vi.fn(),
    insert: vi.fn(async () => {}),
    update: vi.fn(async () => {}),
    delete: vi.fn(async () => {}),
    upsert: vi.fn(async () => {})
  } as unknown as jest.Mocked<DatabaseProvider>;
}

describe('Insert/Update/Delete commands', () => {
  class E {}
  const change = { entity: { id: 1 }, entityClass: E, state: 'added' } as any;

  test('InsertCommand calls provider.insert and callback', async () => {
    const provider = providerStub();
    const after = vi.fn();
    const cmd = new InsertCommand(provider, after);
    await cmd.execute(change);
    expect(provider.insert).toHaveBeenCalledWith(change.entity, E);
    expect(after).toHaveBeenCalledWith(change);
  });

  test('UpdateCommand calls provider.update and callback', async () => {
    const provider = providerStub();
    const after = vi.fn();
    const cmd = new UpdateCommand(provider, after);
    await cmd.execute({ ...change, state: 'modified' });
    expect(provider.update).toHaveBeenCalledWith(change.entity, E);
    expect(after).toHaveBeenCalled();
  });

  test('DeleteCommand tries softDelete handler first, then provider.delete', async () => {
    const provider = providerStub();
    const soft = vi.fn(async () => false);
    const after = vi.fn();
    const cmd = new DeleteCommand(provider, soft, after);
    const ok = await cmd.execute({ ...change, state: 'deleted' });
    expect(soft).toHaveBeenCalled();
    expect(provider.delete).toHaveBeenCalledWith(change.entity, E);
    expect(after).toHaveBeenCalled();
    expect(ok).toBe(true);
  });

  test('DeleteCommand returns early when soft delete handled', async () => {
    const provider = providerStub();
    const soft = vi.fn(async () => true);
    const after = vi.fn();
    const cmd = new DeleteCommand(provider, soft, after);
    const ok = await cmd.execute({ ...change, state: 'deleted' });
    expect(provider.delete).not.toHaveBeenCalled();
    expect(after).not.toHaveBeenCalled();
    expect(ok).toBe(true);
  });
});
