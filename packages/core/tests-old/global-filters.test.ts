import 'reflect-metadata';
import { DbContext, DbSet } from '@ts-linq/orm';
import { Entity, Column, PrimaryKey } from '@ts-linq/core';
import { DatabaseProvider } from '../src/DatabaseProvider';
import { MetadataStorage } from '@ts-linq/metadata';
import type { SqlDialect } from '../src/query/SqlDialect';
import type { SqlParameter } from '@ts-linq/types';

function defineEntities() {
  @Entity()
  class Item {
    @PrimaryKey({ autoIncrement: true }) id!: number;
    @Column({ type: 'TEXT', nullable: false }) name!: string;
    @Column({ type: 'BOOLEAN', nullable: false, defaultValue: false }) isDeleted!: boolean;
  }
  return { Item };
}

class Ctx extends DbContext {
  public items!: DbSet<InstanceType<ReturnType<typeof defineEntities>['Item']>>;
  constructor(filters?: Array<{ entity: Function; where: { condition: string; parameters: [] } }>) {
    const provider = new (class extends DatabaseProvider {
      private tables = new Map<string, { rows: any[]; pk?: string }>();
      public async connect(): Promise<void> {}
      public async disconnect(): Promise<void> {}
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
          buildSelect: (ctor, opts) => {
            const meta = MetadataStorage.getEntity(ctor as unknown as Function)!;
            let query = `SELECT * FROM ${meta.tableName}`;
            const parameters: SqlParameter[] = [];
            if (opts.where && opts.where.length) {
              query += ' WHERE ' + opts.where.map((w) => w.condition).join(' AND ');
              for (const w of opts.where) parameters.push(...w.parameters);
            }
            return { query, parameters } as const;
          }
        } as unknown as SqlDialect;
      }
      public async insert<T extends object>(e: T, entityClass: Function): Promise<T> {
        const meta = MetadataStorage.getEntity(entityClass)!;
        const table = meta.tableName;
        const slot = this.tables.get(table)!;
        const pk = meta.primaryKeys[0];
        const copy: any = { ...(e as any) };
        if (pk && (copy[pk] === undefined || copy[pk] === null)) {
          copy[pk] = (slot.rows.length ? slot.rows[slot.rows.length - 1][pk] || 0 : 0) + 1;
          (e as any)[pk] = copy[pk];
        }
        slot.rows.push(copy);
        return e;
      }
      public async update<T extends object>(e: T, entityClass: Function): Promise<T> {
        const meta = MetadataStorage.getEntity(entityClass)!;
        const table = meta.tableName;
        const pk = meta.primaryKeys[0];
        const slot = this.tables.get(table)!;
        const idx = slot.rows.findIndex((r) => r[pk] === (e as any)[pk]);
        if (idx >= 0) slot.rows[idx] = { ...(e as any) };
        return e;
      }
      public async delete<T extends object>(): Promise<void> {}
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
      protected async doExecuteQuery<T>(
        sql: string,
        params: readonly SqlParameter[] = []
      ): Promise<T[]> {
        const from = /FROM\s+(\w+)/i.exec(sql);
        const slot = from ? this.tables.get(from[1]) : undefined;
        if (!slot) return [] as T[];
        // handle simple soft-delete filter
        let rows = slot.rows.slice();
        if (/isDeleted\s*=\s*0/i.test(sql)) {
          rows = rows.filter((r) => !r.isDeleted);
        }
        // handle simple name = ? filter
        const nameEq = /name\s*=\s*\?/i.test(sql);
        if (nameEq && params.length > 0) {
          const needle = String(params[0]);
          rows = rows.filter((r) => r.name === needle);
        }
        return rows as unknown as T[];
      }
      protected async doExecuteNonQuery(): Promise<number> {
        return 0;
      }
      public async beginTransaction(): Promise<void> {}
      public async commitTransaction(): Promise<void> {}
      public async rollbackTransaction(): Promise<void> {}
    })('');
    super({ provider, globalFilters: filters } as any);
  }
}

describe('Global filters', () => {
  it('applies soft-delete filter to all queries', async () => {
    const { Item } = defineEntities();
    const ctx = new Ctx([{ entity: Item, where: { condition: 'isDeleted = 0', parameters: [] } }]);
    await ctx.ensureCreated();

    const a = new Item();
    a.name = 'A';
    a.isDeleted = false;
    const b = new Item();
    b.name = 'B';
    b.isDeleted = true;
    ctx.set(Item).add(a);
    ctx.set(Item).add(b);
    await ctx.saveChanges();

    const all = await ctx.set(Item).toArray();
    expect(all.map((x) => x.name)).toEqual(['A']);

    const maybe = await ctx
      .set(Item)
      .where((i) => i.name === 'B')
      .firstOrDefault();
    expect(maybe).toBeNull();

    await ctx.dispose();
  });
});
