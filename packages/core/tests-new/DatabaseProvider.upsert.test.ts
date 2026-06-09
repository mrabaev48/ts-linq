import { MetadataStorage } from '@ts-linq/metadata';
import { EntityNotFoundError, OptimisticConcurrencyError } from '@ts-linq/types';

import { Column } from '../src/decorators/Column';
import { Entity } from '../src/decorators/Entity';
import { PrimaryKey } from '../src/decorators/PrimaryKey';
import { ProviderStub } from '../tests/_stubs/ProviderStub';

function createUser() {
  @Entity({ name: 'users' })
  class User {
    @PrimaryKey()
    @Column({ type: 'INTEGER' })
    id?: number;

    @Column({ type: 'VARCHAR' })
    name?: string;
  }
  return User;
}

describe('DatabaseProvider.upsert (error-path discrimination)', () => {
  let provider: ProviderStub;
  let User: ReturnType<typeof createUser>;

  beforeEach(async () => {
    MetadataStorage.getInstance().clear();
    User = createUser();
    provider = new ProviderStub('test');
    await provider.connect();
    await provider.createTable(MetadataStorage.getEntity(User)!);
  });

  afterEach(() => {
    MetadataStorage.getInstance().clear();
  });

  it('inserts when the row is genuinely absent (typed EntityNotFound signal, no exception-as-control-flow)', async () => {
    const insertSpy = jest.spyOn(provider, 'insert');

    const result = await provider.upsert({ id: 1, name: 'Ada' }, User);

    expect(result).toEqual({ id: 1, name: 'Ada' });
    expect(insertSpy).toHaveBeenCalledTimes(1);
    const all = await provider.findAll(User);
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ id: 1, name: 'Ada' });
  });

  it('updates an existing row without falling back to insert', async () => {
    await provider.insert({ id: 1, name: 'Ada' }, User);
    const insertSpy = jest.spyOn(provider, 'insert');

    await provider.upsert({ id: 1, name: 'Grace' }, User);

    expect(insertSpy).not.toHaveBeenCalled();
    const all = await provider.findAll(User);
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ id: 1, name: 'Grace' });
  });

  it('propagates a non-absent update failure (e.g. concurrency conflict) without inserting a duplicate', async () => {
    await provider.insert({ id: 1, name: 'Ada' }, User);
    jest
      .spyOn(provider, 'update')
      .mockRejectedValue(new OptimisticConcurrencyError('Version mismatch detected during update'));
    const insertSpy = jest.spyOn(provider, 'insert');

    await expect(provider.upsert({ id: 1, name: 'Grace' }, User)).rejects.toBeInstanceOf(
      OptimisticConcurrencyError
    );

    expect(insertSpy).not.toHaveBeenCalled();
    const all = await provider.findAll(User);
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ id: 1, name: 'Ada' });
  });

  it('still falls back to insert on the typed EntityNotFoundError signal', async () => {
    jest
      .spyOn(provider, 'update')
      .mockRejectedValue(new EntityNotFoundError('No rows were updated.'));
    const insertSpy = jest.spyOn(provider, 'insert');

    await provider.upsert({ id: 2, name: 'Linus' }, User);

    expect(insertSpy).toHaveBeenCalledTimes(1);
  });
});
