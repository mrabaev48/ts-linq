import 'reflect-metadata';
import { QueryBuilder } from '../src/query/QueryBuilder';
import { SQLiteProvider } from '../src/providers/SQLiteProvider';
import { Entity, Column, PrimaryKey } from '../src';
import { MetadataStorage } from '../src/metadata/MetadataStorage';

// Define test entity inside function to ensure decorators execute properly
function createQueryTestEntity() {
    @Entity()
    class QueryTestEntity {
        @PrimaryKey({ autoIncrement: true })
        id!: number;

        @Column()
        name!: string;

        @Column()
        age!: number;
    }
    return QueryTestEntity;
}

describe('QueryBuilder', () => {
    let provider: SQLiteProvider;
    let queryBuilder: QueryBuilder<InstanceType<ReturnType<typeof createQueryTestEntity>>>;
    let QueryTestEntity: ReturnType<typeof createQueryTestEntity>;

    beforeEach(async () => {
        MetadataStorage.getInstance().clear();
        // Create test entity
        QueryTestEntity = createQueryTestEntity();

        provider = new SQLiteProvider(':memory:');
        await provider.connect();

        const metadata = MetadataStorage.getEntity(QueryTestEntity)!;
        await provider.createTable(metadata);

        // Insert test data
        for (let i = 1; i <= 10; i++) {
            const entity = new QueryTestEntity();
            entity.name = `Name ${i}`;
            entity.age = 20 + i;
            await provider.insert(entity, QueryTestEntity);
        }

        queryBuilder = new QueryBuilder(QueryTestEntity, provider) as QueryBuilder<InstanceType<typeof QueryTestEntity>>;
    });

    afterEach(async () => {
        await provider.disconnect();
    });

    describe('basic operations', () => {
        it('should return all entities with toArray', async () => {
            const results = await queryBuilder.toArray();
            expect(results).toHaveLength(10);
        });

        it('should count entities', async () => {
            const count = await queryBuilder.count();
            expect(count).toBe(10);
        });

        it('should check if any entities exist', async () => {
            const any = await queryBuilder.any();
            expect(any).toBe(true);
        });
    });

    describe('take and skip', () => {
        it('should limit results with take', async () => {
            const results = await queryBuilder.take(5).toArray();
            expect(results).toHaveLength(5);
        });

        it('should skip results', async () => {
            const results = await queryBuilder.skip(5).toArray();
            expect(results).toHaveLength(5);
        });

        it('should combine take and skip for pagination', async () => {
            const results = await queryBuilder.skip(3).take(2).toArray();
            expect(results).toHaveLength(2);
        });
    });

    describe('ordering', () => {
        it('should order by ascending', async () => {
            const results = await queryBuilder
                .orderBy(entity => entity.age)
                .toArray();
            
            expect(results[0].age).toBeLessThan(results[1].age);
        });

        it('should order by descending', async () => {
            const results = await queryBuilder
                .orderByDescending(entity => entity.age)
                .toArray();
            
            expect(results[0].age).toBeGreaterThan(results[1].age);
        });
    });

    describe('first operations', () => {
        it('should get first entity', async () => {
            const first = await queryBuilder.first();
            expect(first).toBeDefined();
            expect(first.id).toBe(1);
        });

        it('should get firstOrDefault', async () => {
            const firstOrDefault = await queryBuilder.firstOrDefault();
            expect(firstOrDefault).toBeDefined();
        });

        it('should throw on first when no results', async () => {
            // Clear all data
            await provider.executeNonQuery('DELETE FROM QueryTestEntity');
            
            await expect(queryBuilder.first()).rejects.toThrow('Sequence contains no elements');
        });

        it('should return null on firstOrDefault when no results', async () => {
            // Clear all data
            await provider.executeNonQuery('DELETE FROM QueryTestEntity');
            
            const result = await queryBuilder.firstOrDefault();
            expect(result).toBeNull();
        });
    });

    describe('single operations', () => {
        it('should get single entity when only one exists', async () => {
            // Clear all data and insert one
            await provider.executeNonQuery('DELETE FROM QueryTestEntity');
            const entity = new QueryTestEntity();
            entity.name = 'Single';
            entity.age = 25;
            await provider.insert(entity, QueryTestEntity);

            const single = await queryBuilder.single();
            expect(single).toBeDefined();
            expect(single.name).toBe('Single');
        });

        it('should throw on single when no entities exist', async () => {
            // Clear all data
            await provider.executeNonQuery('DELETE FROM QueryTestEntity');
            
            await expect(queryBuilder.single()).rejects.toThrow('Sequence contains no elements');
        });

        it('should throw on single when multiple entities exist', async () => {
            await expect(queryBuilder.single()).rejects.toThrow('Sequence contains more than one element');
        });

        it('should return null on singleOrDefault when no entities exist', async () => {
            // Clear all data
            await provider.executeNonQuery('DELETE FROM QueryTestEntity');
            
            const result = await queryBuilder.singleOrDefault();
            expect(result).toBeNull();
        });

        it('should throw on singleOrDefault when multiple entities exist', async () => {
            await expect(queryBuilder.singleOrDefault()).rejects.toThrow('Sequence contains more than one element');
        });
    });

    describe('distinct', () => {
        it('should return distinct results', async () => {
            const results = await queryBuilder.distinct().toArray();
            expect(results).toHaveLength(10); // All are already distinct in our test data
        });
    });
});
