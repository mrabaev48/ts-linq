import 'reflect-metadata';
import { DbSet } from '../src/context/DbSet';
import { SQLiteProvider } from '../src/providers/SQLiteProvider';
import { ChangeTracker } from '../src/change-tracking/ChangeTracker';
import { Entity, Column, PrimaryKey } from '../src';
import { MetadataStorage } from '../src/metadata/MetadataStorage';
import { EntityState } from '../src/types';

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
    let provider: SQLiteProvider;
    let changeTracker: ChangeTracker;
    let TestEntity: ReturnType<typeof createTestEntity>;

    beforeEach(async () => {
        MetadataStorage.getInstance().clear();
        // Create test entity
        TestEntity = createTestEntity();

        provider = new SQLiteProvider(':memory:');
        changeTracker = new ChangeTracker();
        dbSet = new DbSet(TestEntity, provider, changeTracker) as DbSet<InstanceType<typeof TestEntity>>;

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
    });
});
