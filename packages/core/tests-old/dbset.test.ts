import 'reflect-metadata';
import { DbSet } from '../src/context/DbSet';
import { DatabaseProvider } from '../src/DatabaseProvider';
import { ChangeTracker } from '../src/change-tracking/ChangeTracker';
import { Entity, Column, PrimaryKey } from '@ts-linq/core';
import { MetadataStorage } from '@ts-linq/metadata';
import type { SqlDialect } from '../src/query/SqlDialect';
import type { SqlParameter } from '@ts-linq/types';

class ProviderStub extends DatabaseProvider {
  private tables = new Map<string, { rows: any[]; pk?: string }>();
  public async connect(): Promise<void> {
    /* no-op */
  }
  public async disconnect(): Promise<void> {
    /* no-op */
  }
  public async createTable(
    entityMetadata: ReturnType<typeof MetadataStorage.getEntity>
  ): Promise<void> {
    if (!entityMetadata) return;
    const table = entityMetadata.tableName;
    const pk = entityMetadata.primaryKeys[0];
    if (!this.tables.has(table)) this.tables.set(table, { rows: [], pk });
  }
  public getDialect(): SqlDialect {
    return {
      buildSelect: (ctor) => {
        const meta = MetadataStorage.getEntity(ctor as unknown as Function)!;
        return { query: `SELECT * FROM ${meta.tableName}`, parameters: [] };
      }
    } as unknown as SqlDialect;
  }
  public async insert<T extends object>(entity: T, entityClass: Function): Promise<T> {
    const meta = MetadataStorage.getEntity(entityClass);
    const table = meta!.tableName;
    const slot = this.tables.get(table)!;
    const pk = meta!.primaryKeys[0];
    const copy: any = { ...(entity as any) };
    if (pk && (copy[pk] === undefined || copy[pk] === null)) {
      copy[pk] = (slot.rows.length ? slot.rows[slot.rows.length - 1][pk] || 0 : 0) + 1;
      (entity as any)[pk] = copy[pk];
    }
    slot.rows.push(copy);
    return entity;
  }
  public async update<T extends object>(entity: T, entityClass: Function): Promise<T> {
    const meta = MetadataStorage.getEntity(entityClass)!;
    const table = meta.tableName;
    const pk = meta.primaryKeys[0];
    const slot = this.tables.get(table)!;
    const idx = slot.rows.findIndex((r) => r[pk] === (entity as any)[pk]);
    if (idx >= 0) slot.rows[idx] = { ...entity };
    return entity;
  }
  public async delete<T extends object>(entity: T, entityClass: Function): Promise<void> {
    const meta = MetadataStorage.getEntity(entityClass)!;
    const table = meta.tableName;
    const pk = meta.primaryKeys[0];
    const slot = this.tables.get(table)!;
    const idx = slot.rows.findIndex((r) => r[pk] === (entity as any)[pk]);
    if (idx >= 0) slot.rows.splice(idx, 1);
  }
  public async findById<T extends object>(
    id: unknown,
    entityClass: new () => T
  ): Promise<T | null> {
    const meta = MetadataStorage.getEntity(entityClass)!;
    const table = meta.tableName;
    const pk = meta.primaryKeys[0];
    const slot = this.tables.get(table)!;
    const row = slot.rows.find((r) => r[pk] === id);
    return (row ?? null) as T | null;
  }
  public async findAll<T extends object>(entityClass: new () => T): Promise<T[]> {
    const meta = MetadataStorage.getEntity(entityClass)!;
    const table = meta.tableName;
    const slot = this.tables.get(table)!;
    return slot.rows.slice() as T[];
  }
  public async findWhere<T extends object>(): Promise<T[]> {
    return [];
  }
  public async findWhereIn<T extends object>(): Promise<T[]> {
    return [];
  }
  protected async doExecuteQuery<T>(sql: string, _params?: readonly SqlParameter[]): Promise<T[]> {
    const countMatch = /SELECT\s+COUNT\(\*\)\s+as\s+count\s+FROM\s+(\w+)/i.exec(sql);
    if (countMatch) {
      const table = countMatch[1];
      const slot = this.tables.get(table);
      const n = slot ? slot.rows.length : 0;
      return [{ count: n }] as unknown as T[];
    }
    const m = /FROM\s+(\w+)/i.exec(sql);
    if (m) {
      const table = m[1];
      const slot = this.tables.get(table);
      if (slot) return slot.rows.slice() as T[];
    }
    return [] as T[];
  }
  protected async doExecuteNonQuery(sql: string): Promise<number> {
    const m = /DELETE\s+FROM\s+(\w+)/i.exec(sql);
    if (m) {
      const table = m[1];
      const slot = this.tables.get(table);
      if (slot) {
        const n = slot.rows.length;
        slot.rows = [];
        return n;
      }
    }
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
import { EntityState } from '@ts-linq/types';

// Define test entity inside function to ensure decorators execute properly
function createTestEntity() {
  @Entity()
  class TestEntity {
    @PrimaryKey({ autoIncrement: true })
    id!: number;

    @Column()
    name!: string;
  }
  return TestEntity;
}

describe('DbSet', () => {
  let dbSet: DbSet<InstanceType<ReturnType<typeof createTestEntity>>>;
  let provider: ProviderStub;
  let changeTracker: ChangeTracker;
  let TestEntity: ReturnType<typeof createTestEntity>;

  beforeEach(async () => {
    MetadataStorage.getInstance().clear();
    // Create test entity
    TestEntity = createTestEntity();

    provider = new ProviderStub('');
    changeTracker = new ChangeTracker();
    dbSet = new DbSet(TestEntity, provider, changeTracker);

    await provider.connect();
    const metadata = MetadataStorage.getEntity(TestEntity)!;
    await provider.createTable(metadata);
  });

  afterEach(async () => {
    await provider.disconnect();
  });

  describe('add', () => {
    it('should track entity as added', () => {
      const entity = new TestEntity();
      entity.name = 'Test';

      const result = dbSet.add(entity);

      expect(result).toBe(entity);
      expect(changeTracker.getEntityState(entity)).toBe(EntityState.Added);
    });
  });

  describe('update', () => {
    it('should track entity as modified', () => {
      const entity = new TestEntity();
      entity.name = 'Test';

      const result = dbSet.update(entity);

      expect(result).toBe(entity);
      expect(changeTracker.getEntityState(entity)).toBe(EntityState.Modified);
    });
  });

  describe('remove', () => {
    it('should track entity as deleted', () => {
      const entity = new TestEntity();
      entity.name = 'Test';

      const result = dbSet.remove(entity);

      expect(result).toBe(entity);
      expect(changeTracker.getEntityState(entity)).toBe(EntityState.Deleted);
    });
  });

  describe('find', () => {
    it('should find entity by id', async () => {
      const entity = new TestEntity();
      entity.name = 'Test Entity';

      const inserted = await provider.insert(entity, TestEntity);
      const found = await dbSet.find(inserted.id);

      expect(found).toBeDefined();
      expect(found!.name).toBe('Test Entity');
    });

    it('should return null for non-existent id', async () => {
      const found = await dbSet.find(999);
      expect(found).toBeNull();
    });
  });

  describe('toArray', () => {
    it('should return all entities', async () => {
      const entity1 = new TestEntity();
      entity1.name = 'Entity 1';
      const entity2 = new TestEntity();
      entity2.name = 'Entity 2';

      await provider.insert(entity1, TestEntity);
      await provider.insert(entity2, TestEntity);

      const entities = await dbSet.toArray();
      expect(entities).toHaveLength(2);
    });
  });

  describe('query methods', () => {
    beforeEach(async () => {
      for (let i = 1; i <= 5; i++) {
        const entity = new TestEntity();
        entity.name = `Entity ${i}`;
        await provider.insert(entity, TestEntity);
      }
    });

    it('should count entities', async () => {
      const count = await dbSet.count();
      expect(count).toBe(5);
    });

    it('should check if any entities exist', async () => {
      const any = await dbSet.any();
      expect(any).toBe(true);
    });

    it('should get first entity', async () => {
      const first = await dbSet.first();
      expect(first).toBeDefined();
      expect(first.name).toBe('Entity 1');
    });

    it('should get first or default', async () => {
      const firstOrDefault = await dbSet.firstOrDefault();
      expect(firstOrDefault).toBeDefined();
    });

    it('should throw on first when no entities exist', async () => {
      // Clear all entities
      await provider.executeNonQuery('DELETE FROM TestEntity');

      await expect(dbSet.first()).rejects.toThrow('Sequence contains no elements');
    });

    it('should return null on firstOrDefault when no entities exist', async () => {
      // Clear all entities
      await provider.executeNonQuery('DELETE FROM TestEntity');

      const result = await dbSet.firstOrDefault();
      expect(result).toBeNull();
    });

    it('should support include(selector) chained before where', async () => {
      // include now validates against metadata; using non-existing relation should throw
      await expect(async () => {
        await dbSet
          .include((e) => (e as unknown as { nonExistingRelation: unknown }).nonExistingRelation)
          .where((e) => e.name === 'Entity 1')
          .toArray();
      }).rejects.toThrow(/Invalid include/);
    });
  });
});
