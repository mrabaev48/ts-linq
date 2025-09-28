import 'reflect-metadata';
import { SQLiteProvider } from '../src/providers/SQLiteProvider';
import { Entity, Column, PrimaryKey } from '../src';
import { MetadataStorage } from '../src/metadata/MetadataStorage';
import { Queryable } from '../src/query/Queryable';

function createEntity() {
  @Entity()
  class E {
    @PrimaryKey({ autoIncrement: true }) id!: number;
    @Column() name!: string;
    @Column() age!: number;
  }
  return E;
}

describe('Queryable', () => {
  let provider: SQLiteProvider;
  let E: ReturnType<typeof createEntity>;
  let q: Queryable<InstanceType<ReturnType<typeof createEntity>>>;

  beforeEach(async () => {
    MetadataStorage.getInstance().clear();
    E = createEntity();
    provider = new SQLiteProvider(':memory:');
    await provider.connect();
    await provider.createTable(MetadataStorage.getEntity(E));
    for (let i = 1; i <= 3; i++) {
      const e = new E();
      e.name = `N${i}`;
      e.age = 20 + i;
      await provider.insert(e, E);
    }
    q = new Queryable(E, provider);
  });

  afterEach(async () => {
    await provider.disconnect();
  });

  it('toArray returns all', async () => {
    const res = await q.toArray();
    expect(res).toHaveLength(3);
  });

  it('where with >= translates to SQL', async () => {
    const res = await q.where((e) => e.age >= 22).toArray();
    expect(res.every((x) => x.age >= 22)).toBe(true);
  });
});
