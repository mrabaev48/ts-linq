import { DbContext } from '../../src/context/DbContext';
import { MetadataStorage } from '../../src/metadata/MetadataStorage';
import type { ColumnMetadata, SqlParameter } from '../../src/types';
import { ValidationError } from '../../src/types';
import { DatabaseProvider } from '../../src/DatabaseProvider';
import type { SqlDialect } from '../../src/query/SqlDialect';

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
}

class Ctx extends DbContext {
  constructor() {
    super({ provider: new ProviderStub() });
  }
}

describe('Validation order: base before ValidIf', () => {
  beforeEach(() => {
    MetadataStorage.getInstance().clear();
    MetadataStorage.addEntity(User, 'Users');
    const cols: ColumnMetadata[] = [
      { propertyName: 'id', columnName: 'id', type: 'INTEGER', nullable: false, isGenerated: true },
      { propertyName: 'name', columnName: 'name', type: 'TEXT', nullable: false, length: 10 }
    ];
    cols.forEach((c) => MetadataStorage.addColumn(User, c));
    MetadataStorage.addPrimaryKey(User, 'id');
    // ValidIf: name must be non-empty and <= 10 (redundant with base length)
    const rules = [
      {
        propertyName: 'name',
        predicate: (e: unknown) => !!(e as User).name && (e as User).name.length <= 10,
        message: 'Name required and <= 10'
      }
    ];
    Reflect.defineMetadata('orm:validations', rules, User);
  });

  test('NotNull/length are enforced; error contains base check message', async () => {
    const ctx = new Ctx();
    const set = ctx.set(User);
    const u = new User();
    // leave name undefined to trigger NotNull
    set.add(u);
    await expect(ctx.saveChanges()).rejects.toBeInstanceOf(ValidationError);
    try {
      await ctx.saveChanges();
    } catch (e) {
      const ve = e as ValidationError;
      const msgs = (ve.details || []).map((d) => d.message);
      expect(msgs.some((m) => m.includes('Value cannot be null'))).toBe(true);
    }
    await ctx.dispose();
  });
});
