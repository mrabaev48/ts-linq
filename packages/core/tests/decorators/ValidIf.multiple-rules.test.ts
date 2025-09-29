import 'reflect-metadata';
import { DbContext } from '../../src/context/DbContext';
import { MetadataStorage } from '../../src/metadata/MetadataStorage';
import type { ColumnMetadata } from '../../src/types';
import type { ValidationError } from '../../src/types';
import { DatabaseProvider } from '../../src/DatabaseProvider';
import type { SqlDialect } from '../../src/query/SqlDialect';
import { ValidIfOf, MinLengthOf } from '../../src/decorators/ValidIf';

class ProviderStub extends DatabaseProvider {
  constructor() {
    super('');
    this.providerName = 'test';
  }
  public async connect(): Promise<void> {
    this.isConnected = true;
  }
  public async disconnect(): Promise<void> {
    this.isConnected = false;
  }
  public async createTable(): Promise<void> {
    /* no-op */
  }
  public getDialect(): SqlDialect {
    return { buildSelect: () => ({ query: '', parameters: [] }) };
  }
  public async insert<T extends object>(e: T): Promise<T> {
    return e;
  }
  public async update<T extends object>(e: T): Promise<T> {
    return e;
  }
  public async delete<T extends object>(): Promise<void> {
    /* no-op */
  }
  public async findById<T extends object>(): Promise<T | null> {
    return null;
  }
  public async findAll<T extends object>(): Promise<T[]> {
    return [];
  }
  public async findWhere<T extends object>(): Promise<T[]> {
    return [];
  }
  public async findWhereIn<T extends object>(): Promise<T[]> {
    return [];
  }
  protected async doExecuteQuery<T>(): Promise<T[]> {
    return [];
  }
  protected async doExecuteNonQuery(): Promise<number> {
    return 0;
  }
  public async beginTransaction(): Promise<void> {
    this.inTransaction = true;
  }
  public async commitTransaction(): Promise<void> {
    this.inTransaction = false;
  }
  public async rollbackTransaction(): Promise<void> {
    this.inTransaction = false;
  }
}

class User {
  id!: number;
  name!: string;
  email!: string;
}

class Ctx extends DbContext {
  constructor() {
    super({ provider: new ProviderStub() });
  }
}

describe('Multiple ValidIf rules', () => {
  beforeEach(() => {
    MetadataStorage.getInstance().clear();
    MetadataStorage.addEntity(User, 'Users');
    const cols: ColumnMetadata[] = [
      { propertyName: 'id', columnName: 'id', type: 'INTEGER', nullable: false, isGenerated: true },
      { propertyName: 'name', columnName: 'name', type: 'TEXT', nullable: false },
      { propertyName: 'email', columnName: 'email', type: 'TEXT', nullable: false }
    ];
    cols.forEach((c) => MetadataStorage.addColumn(User, c));
    MetadataStorage.addPrimaryKey(User, 'id');
    // Attach two rules to the same property (name): non-empty and min length 3
    MinLengthOf<User>(3, 'Name too short')(
      undefined as unknown as object,
      {
        kind: 'field',
        name: 'name',
        addInitializer: (fn: (this: unknown) => void) => fn.call(User.prototype)
      } as any
    );
    ValidIfOf<User>((u) => !!u.name, 'Name required')(
      undefined as unknown as object,
      {
        kind: 'field',
        name: 'name',
        addInitializer: (fn: (this: unknown) => void) => fn.call(User.prototype)
      } as any
    );
  });

  test('aggregates multiple errors for the same property', async () => {
    const ctx = new Ctx();
    const set = ctx.set(User);
    const u = new User();
    u.email = 'a@b';
    u.name = ''; // violates both rules
    set.add(u);
    try {
      await ctx.saveChanges();
      fail('expected ValidationError');
    } catch (e) {
      const ve = e as ValidationError;
      const messages = (ve.details || [])
        .filter((d) => d.property === 'name')
        .map((d) => d.message);
      expect(messages.some((m) => m.includes('Name required'))).toBe(true);
      expect(messages.some((m) => m.includes('too short'))).toBe(true);
    }
    await ctx.dispose();
  });
});
