import type { SqlParameter } from '@ts-linq/types';

export interface DatabaseProvider {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  execute<T = Record<string, unknown>>(sql: string, params: readonly SqlParameter[]): Promise<T[]>;
  beginTransaction(): Promise<void>;
  commitTransaction(): Promise<void>;
  rollbackTransaction(): Promise<void>;
}

export interface DatabaseHarnessOptions {
  provider: DatabaseProvider;
  autoConnect?: boolean;
}

export class DatabaseHarness {
  private provider?: DatabaseProvider;
  private cleanup: (() => Promise<void>)[] = [];

  async setup(options: DatabaseHarnessOptions): Promise<DatabaseProvider> {
    this.provider = options.provider;

    if (options.autoConnect !== false) {
      await this.provider.connect();
      this.cleanup.push(async () => this.provider!.disconnect());
    }

    return this.provider;
  }

  async createSchema(provider: DatabaseProvider, entities: Function[]): Promise<void> {
    for (const entity of entities) {
      const tableName = this.getTableName(entity);
      await provider.execute(`CREATE TABLE IF EXISTS ${tableName} (id INTEGER PRIMARY KEY)`, []);
    }
  }

  async dropSchema(provider: DatabaseProvider, entities: Function[]): Promise<void> {
    for (const entity of entities.reverse()) {
      const tableName = this.getTableName(entity);
      await provider.execute(`DROP TABLE IF EXISTS ${tableName}`, []);
    }
  }

  async seed<T>(provider: DatabaseProvider, entity: Function, data: Partial<T>[]): Promise<void> {
    const tableName = this.getTableName(entity);

    for (const item of data) {
      const keys = Object.keys(item);
      const values = Object.values(item as object);
      const placeholders = values.map((_, i) => `?`).join(', ');

      const sql = `INSERT INTO ${tableName} (${keys.join(', ')}) VALUES (${placeholders})`;
      await provider.execute(sql, values);
    }
  }

  async teardown(): Promise<void> {
    for (const fn of this.cleanup.reverse()) {
      await fn();
    }
    this.cleanup = [];
    this.provider = undefined;
  }

  private getTableName(entity: Function): string {
    return entity.name.toLowerCase();
  }
}

export function createDatabaseHarness(): DatabaseHarness {
  return new DatabaseHarness();
}
