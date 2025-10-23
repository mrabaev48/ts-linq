import 'reflect-metadata';
import { DbContext } from '../src/context/DbContext';
import { ProviderStub } from './_stubs/ProviderStub';
import { Entity, Column, PrimaryKey, OneToMany, ManyToOne } from '../src';
import { MetadataStorage } from '../src/metadata/MetadataStorage';
import { LoadingStrategy } from '../src/loading/LoadingStrategy';

class TestLogger {
  public crossQueryCalls: Array<{
    op: 'IN-chunk';
    chunks: number;
    size: number;
    entity: string;
    column: string;
    provider?: string;
  }> = [];
  crossQuery(p: {
    op: 'IN-chunk';
    chunks: number;
    size: number;
    entity: string;
    column: string;
    provider?: string;
  }): void {
    this.crossQueryCalls.push(p);
  }
}

@Entity({ name: 'items' })
class Item {
  @PrimaryKey()
  @Column({ type: 'INTEGER' })
  id!: number;
}

class Ctx extends DbContext {
  public get items() {
    return this.set(Item);
  }
  constructor(provider: ProviderStub) {
    super({ provider, performance: { inClauseChunkSize: 2 } });
  }
}

describe('crossQuery logging for IN chunking', () => {
  test('EntityLoader batched one-to-many emits IN-chunk event', async () => {
    @Entity({ name: 'parents' })
    class Parent {
      @PrimaryKey()
      @Column({ type: 'INTEGER' })
      id!: number;
      @OneToMany(() => Child, { foreignKey: 'parentId' })
      children!: Child[];
    }
    @Entity({ name: 'children' })
    class Child {
      @PrimaryKey()
      @Column({ type: 'INTEGER' })
      id!: number;
      @Column({ type: 'INTEGER' })
      parentId!: number;
      @ManyToOne(() => Parent, { foreignKey: 'parentId' })
      parent!: Parent;
    }

    const logger = new TestLogger();
    const provider = new ProviderStub(':mem:', logger);
    const ctx = new (class extends DbContext {
      public get parents() {
        return this.set(Parent);
      }
      constructor() {
        super({ provider, performance: { inClauseChunkSize: 2 } } as any);
      }
    })();
    await provider.createTable(MetadataStorage.getEntity(Parent)!);
    await provider.createTable(MetadataStorage.getEntity(Child)!);
    for (let i = 1; i <= 5; i++) {
      await provider.insert({ id: i } as Parent, Parent);
      await provider.insert({ id: i, parentId: i } as Child, Child);
    }
    const loader = (ctx as unknown as { entityLoader: any }).entityLoader as {
      loadEntities: <T extends object>(
        e: new () => T,
        o: { strategy: LoadingStrategy }
      ) => Promise<T[]>;
    };
    const parents = await loader.loadEntities(Parent, { strategy: LoadingStrategy.Eager });
    expect(parents.length).toBe(5);
    expect(logger.crossQueryCalls.some((e) => e.op === 'IN-chunk' && e.entity === 'Child')).toBe(
      true
    );
  });
});
