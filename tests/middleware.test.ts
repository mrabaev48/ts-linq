import 'reflect-metadata';
import { SQLiteProvider, Entity, Column, PrimaryKey, MetadataStorage, OrmMiddleware, SqlParameter } from '../src';

// Re-export convenience decorators to avoid path confusion in tests
// Some tests import from '../src', but here we import directly to be explicit

function defineUserEntity() {
  @Entity()
  class User {
    @PrimaryKey({ autoIncrement: true })
    id!: number;

    @Column({ type: 'TEXT', nullable: false })
    name!: string;
  }
  return User;
}

describe('OrmMiddleware pipeline', () => {
  let provider: SQLiteProvider;
  let User: ReturnType<typeof defineUserEntity>;
  const beforeCalls: Array<{ sql: string; params: readonly SqlParameter[] }> = [];
  const afterCalls: Array<{ sql: string; params: readonly SqlParameter[]; durationMs: number; rows?: number }> = [];
  const materialized: Array<any> = [];

  const mw: OrmMiddleware = {
    beforeExecute: ({ sql, params }) => {
      beforeCalls.push({ sql, params });
    },
    afterExecute: ({ sql, params, durationMs, rows }) => {
      afterCalls.push({ sql, params, durationMs, rows });
    },
    entityMaterialized: ({ entity }) => {
      materialized.push(entity);
    }
  };

  beforeEach(async () => {
    MetadataStorage.getInstance().clear();
    User = defineUserEntity();
    provider = new SQLiteProvider(':memory:', undefined, [mw]);
    await provider.connect();
    beforeCalls.length = 0;
    afterCalls.length = 0;
    materialized.length = 0;
    await provider.createTable(MetadataStorage.getEntity(User)!);
  });

  afterEach(async () => {
    await provider.disconnect();
  });

  it('invokes before/after and entityMaterialized', async () => {
    const u = new User();
    u.name = 'Alice';
    await provider.insert(u, User);

    const all = await provider.findAll(User);
    expect(all).toHaveLength(1);

    // before/after should have been called at least once for DDL, INSERT, and SELECT
    expect(beforeCalls.length).toBeGreaterThanOrEqual(3);
    expect(afterCalls.length).toBeGreaterThanOrEqual(3);

    // afterExecute includes durationMs
    const lastAfter = afterCalls[afterCalls.length - 1];
    expect(typeof lastAfter.durationMs).toBe('number');
    expect(lastAfter.durationMs).toBeGreaterThanOrEqual(0);

    // entityMaterialized should be called for each row mapped
    expect(materialized.length).toBe(1);
    expect(materialized[0].name).toBe('Alice');
  });
});
