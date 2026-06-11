/**
 * Unit tests for {@link BulkDmlExecutor} — the bulk UPDATE/DELETE collaborator extracted from
 * `Queryable` (refactor query/task-1). Verifies the include-guard, metadata guard, dialect-capability
 * guard and the happy paths, with error messages preserved byte-for-byte.
 */
import type { DatabaseProvider } from '@ts-linq/core';
import { MetadataStorage } from '@ts-linq/metadata';
import { MetadataError, UnsupportedOperationError, ValidationError } from '@ts-linq/types';

import { BulkDmlExecutor } from '../src/BulkDmlExecutor';
import { QueryModel } from '../src/QueryModel';
import type { ISetPropertyCalls } from '../src/SetPropertyCalls';

class BulkUser {
  id!: number;
  name!: string;
}

class Unregistered {}

beforeAll(() => {
  MetadataStorage.addEntity(BulkUser, 'bulk_users');
  MetadataStorage.addColumn(BulkUser, { propertyName: 'id', columnName: 'id', type: 'INTEGER' });
  MetadataStorage.addColumn(BulkUser, { propertyName: 'name', columnName: 'name', type: 'TEXT' });
  MetadataStorage.addPrimaryKey(BulkUser, 'id');
});

interface FakeDialect {
  buildBulkUpdate?: jest.Mock;
  buildBulkDelete?: jest.Mock;
}

function makeProvider(
  dialect: FakeDialect,
  executeNonQuery = jest.fn(async () => 3)
): DatabaseProvider {
  return {
    providerLabel: 'test',
    getDialect: () => dialect,
    executeNonQuery
  } as unknown as DatabaseProvider;
}

const noModel = (): QueryModel => new QueryModel();
const setName =
  (value: string) =>
  (s: ISetPropertyCalls<BulkUser>): ISetPropertyCalls<BulkUser> =>
    s.setProperty((e) => e.name, value);

describe('BulkDmlExecutor.update', () => {
  it('rejects when include() was applied', async () => {
    const exec = new BulkDmlExecutor<BulkUser>(BulkUser, makeProvider({}));
    await expect(exec.update(setName('x'), true, noModel)).rejects.toThrow(
      'Cannot call executeUpdate() after include(). Bulk DML does not support eager loading. Remove the include() call.'
    );
    await expect(exec.update(setName('x'), true, noModel)).rejects.toBeInstanceOf(
      UnsupportedOperationError
    );
  });

  it('rejects with a typed MetadataError when entity metadata is missing', async () => {
    const exec = new BulkDmlExecutor<Unregistered>(Unregistered, makeProvider({}));
    await expect(exec.update(() => ({}) as never, false, noModel)).rejects.toThrow(
      'ts-linq: entity metadata not found for Unregistered. Ensure the class is decorated with @Entity().'
    );
    await expect(exec.update(() => ({}) as never, false, noModel)).rejects.toBeInstanceOf(
      MetadataError
    );
  });

  it('rejects with a typed ValidationError when no setProperty() was called', async () => {
    const exec = new BulkDmlExecutor<BulkUser>(BulkUser, makeProvider({}));
    await expect(exec.update((s) => s, false, noModel)).rejects.toThrow(
      'executeUpdate() requires at least one setProperty() call.'
    );
    await expect(exec.update((s) => s, false, noModel)).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects when the dialect cannot build a bulk update', async () => {
    const exec = new BulkDmlExecutor<BulkUser>(BulkUser, makeProvider({}));
    await expect(exec.update(setName('x'), false, noModel)).rejects.toThrow(
      'The current dialect (test) does not support buildBulkUpdate. Implement buildBulkUpdate() on the dialect class.'
    );
  });

  it('builds the bulk update from setter specs and returns the affected-row count', async () => {
    const buildBulkUpdate = jest.fn(
      (spec: { tableName: string; setters: unknown[]; where: unknown[] }) => {
        void spec;
        return { sql: 'UPDATE ...', parameters: ['x'] };
      }
    );
    const executeNonQuery = jest.fn(async () => 7);
    const exec = new BulkDmlExecutor<BulkUser>(
      BulkUser,
      makeProvider({ buildBulkUpdate }, executeNonQuery)
    );

    const result = await exec.update(setName('x'), false, noModel);

    expect(result).toBe(7);
    expect(buildBulkUpdate).toHaveBeenCalledTimes(1);
    const arg = buildBulkUpdate.mock.calls[0][0];
    expect(arg.tableName).toBe('bulk_users');
    expect(arg.setters.length).toBeGreaterThan(0);
    expect(arg.where).toEqual([]);
    expect(executeNonQuery).toHaveBeenCalledWith('UPDATE ...', ['x']);
  });
});

describe('BulkDmlExecutor.delete', () => {
  it('rejects when include() was applied', async () => {
    const exec = new BulkDmlExecutor<BulkUser>(BulkUser, makeProvider({}));
    await expect(exec.delete(true, noModel)).rejects.toThrow(
      'Cannot call executeDelete() after include(). Bulk DML does not support eager loading. Remove the include() call.'
    );
  });

  it('rejects when the dialect cannot build a bulk delete', async () => {
    const exec = new BulkDmlExecutor<BulkUser>(BulkUser, makeProvider({}));
    await expect(exec.delete(false, noModel)).rejects.toThrow(
      'The current dialect (test) does not support buildBulkDelete. Implement buildBulkDelete() on the dialect class.'
    );
  });

  it('builds the bulk delete and returns the affected-row count', async () => {
    const buildBulkDelete = jest.fn(() => ({ sql: 'DELETE ...', parameters: [] }));
    const executeNonQuery = jest.fn(async () => 4);
    const exec = new BulkDmlExecutor<BulkUser>(
      BulkUser,
      makeProvider({ buildBulkDelete }, executeNonQuery)
    );

    const result = await exec.delete(false, noModel);

    expect(result).toBe(4);
    expect(buildBulkDelete).toHaveBeenCalledWith({ tableName: 'bulk_users', where: [] });
    expect(executeNonQuery).toHaveBeenCalledWith('DELETE ...', []);
  });
});
