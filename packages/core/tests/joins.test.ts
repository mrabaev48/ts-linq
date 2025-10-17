import { Entity } from '../src/decorators/Entity';
import { Column } from '../src/decorators/Column';
import { PrimaryKey } from '../src/decorators/PrimaryKey';
import { Queryable } from '../src/query/Queryable';
import { DatabaseProvider } from '../src/DatabaseProvider';
import { SqlParameter } from '../src/types';
import { MetadataStorage } from '../src/metadata/MetadataStorage';

@Entity({ name: 'Authors' })
class Author {
  @PrimaryKey({ autoIncrement: true }) id!: number;
  @Column({ type: 'TEXT' }) name!: string;
}

@Entity({ name: 'Books' })
class Book {
  @PrimaryKey({ autoIncrement: true }) id!: number;
  @Column({ type: 'TEXT' }) title!: string;
  @Column({ type: 'INTEGER' }) authorId!: number;
}

class ProviderStub extends DatabaseProvider {
  public lastSql: string | null = null;
  public async connect(): Promise<void> {}
  public async disconnect(): Promise<void> {}
  public async createTable(): Promise<void> {}
  public getDialect(): any {
    return {
      buildSelect: (ctor: Function, opts: any) => {
        const meta = MetadataStorage.getEntity(ctor as unknown as Function);
        const table = meta?.tableName ?? (ctor as any).name;
        let q = `SELECT * FROM ${table}`;
        if (opts?.joins?.length) {
          for (const j of opts.joins) q += ` ${j.type} JOIN ${j.table} ON ${j.on}`;
        }
        return { query: q, parameters: [] };
      }
    } as any;
  }
  public async insert<T>(e: T): Promise<T> {
    return e;
  }
  public async update<T>(e: T): Promise<T> {
    return e;
  }
  public async delete<T>(): Promise<void> {}
  public async findById<T>(): Promise<T | null> {
    return null;
  }
  public async findAll<T>(): Promise<T[]> {
    return [];
  }
  public async findWhere<T>(): Promise<T[]> {
    return [];
  }
  public async findWhereIn<T>(): Promise<T[]> {
    return [];
  }
  protected async doExecuteQuery<T>(sql: string, params?: readonly SqlParameter[]): Promise<T[]> {
    this.lastSql = sql;
    return [] as unknown as T[];
  }
  protected async doExecuteNonQuery(
    sql: string,
    params?: readonly SqlParameter[]
  ): Promise<number> {
    this.lastSql = sql;
    return 0;
  }
  public async beginTransaction(): Promise<void> {}
  public async commitTransaction(): Promise<void> {}
  public async rollbackTransaction(): Promise<void> {}
  constructor() {
    super('memory');
  }
}

describe('JOIN generation', () => {
  test('innerJoin emits proper JOIN clause', async () => {
    const provider = new ProviderStub();
    // Instantiate to ensure metadata decoration
    new Author();
    new Book();
    const q = new Queryable<Author>(Author, provider);
    await q.innerJoin(Book, (a, b) => a.id === b.authorId).toArray();
    expect(provider.lastSql).toContain('FROM Authors');
    expect(provider.lastSql).toContain('INNER JOIN Books');
    expect(provider.lastSql).toContain('Authors.id = Books.authorId');
  });
  test('leftJoin emits proper JOIN clause', async () => {
    const provider = new ProviderStub();
    new Author();
    new Book();
    const q = new Queryable<Author>(Author, provider);
    await q.leftJoin(Book, (a, b) => a.id === b.authorId).toArray();
    expect(provider.lastSql).toContain('LEFT JOIN Books');
  });
});
