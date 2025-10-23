import 'reflect-metadata';
import { MetadataStorage } from '../src/metadata/MetadataStorage';
import { Entity, Column, PrimaryKey, OneToMany } from '../src';
import { ColumnMetadata, RelationshipMetadata, IndexMetadata } from '../src/types';

@Entity()
class MetadataTestEntity {
  @PrimaryKey({ type: 'INTEGER', autoIncrement: true })
  id!: number;

  @Column({ type: 'TEXT', nullable: false })
  name!: string;

  @Column({ type: 'TEXT' })
  email!: string;

  @OneToMany(() => MetadataRelatedEntity)
  related!: MetadataRelatedEntity[];
}

@Entity({ name: 'custom_related_table' })
class MetadataRelatedEntity {
  @PrimaryKey({ type: 'INTEGER' })
  id!: number;

  @Column({ type: 'TEXT' })
  title!: string;
}

describe('MetadataStorage', () => {
  beforeEach(() => {
    MetadataStorage.getInstance().clear();
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = MetadataStorage.getInstance();
      const instance2 = MetadataStorage.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('entity registration', () => {
    it('should register entity with decorators', () => {
      // Force metadata registration by creating instance
      new MetadataTestEntity();
      new MetadataRelatedEntity();

      const testEntityMetadata = MetadataStorage.getEntity(MetadataTestEntity);
      const relatedEntityMetadata = MetadataStorage.getEntity(MetadataRelatedEntity);

      expect(testEntityMetadata).toBeDefined();
      expect(testEntityMetadata!.tableName).toBe('MetadataTestEntity');
      expect(testEntityMetadata!.target).toBe(MetadataTestEntity);

      expect(relatedEntityMetadata).toBeDefined();
      // Stage-3: Table name comes from @Entity({ name: '...' }) decorator
      expect(relatedEntityMetadata!.tableName).toBe('custom_related_table');
      expect(relatedEntityMetadata!.target).toBe(MetadataRelatedEntity);
    });

    it('should register columns with metadata', () => {
      new MetadataTestEntity();

      const metadata = MetadataStorage.getEntity(MetadataTestEntity);
      expect(metadata!.columns).toHaveLength(3);

      const idColumn = metadata!.columns.find((c) => c.propertyName === 'id');
      expect(idColumn).toBeDefined();
      expect(idColumn!.isGenerated).toBe(true);
      expect(idColumn!.nullable).toBe(false);

      const nameColumn = metadata!.columns.find((c) => c.propertyName === 'name');
      expect(nameColumn).toBeDefined();
      expect(nameColumn!.nullable).toBe(false);

      const emailColumn = metadata!.columns.find((c) => c.propertyName === 'email');
      expect(emailColumn).toBeDefined();
      expect(emailColumn!.nullable).toBe(true); // Default nullable
    });

    it('should register primary keys', () => {
      new MetadataTestEntity();

      const metadata = MetadataStorage.getEntity(MetadataTestEntity);
      expect(metadata!.primaryKeys).toContain('id');
      expect(metadata!.primaryKeys).toHaveLength(1);
    });

    it('should register relationships', () => {
      new MetadataTestEntity();

      const metadata = MetadataStorage.getEntity(MetadataTestEntity);
      expect(metadata!.relationships).toHaveLength(1);

      const relationship = metadata!.relationships[0];
      expect(relationship.propertyName).toBe('related');
      expect(relationship.type).toBe('one-to-many');
      const target =
        typeof relationship.targetEntity === 'function'
          ? (relationship.targetEntity as Function)
          : (relationship.targetEntity as () => Function)();
      expect(target).toBe(MetadataRelatedEntity);
    });
  });

  describe('static methods', () => {
    beforeEach(() => {
      // Create test instances to register metadata
      new MetadataTestEntity();
      new MetadataRelatedEntity();
    });

    it('should get all entities', () => {
      const entities = MetadataStorage.getEntities();
      expect(entities).toHaveLength(2);

      const entityNames = entities.map((e) => e.target.name);
      expect(entityNames).toContain('MetadataTestEntity');
      expect(entityNames).toContain('MetadataRelatedEntity');
    });

    it('should get specific entity', () => {
      const entity = MetadataStorage.getEntity(MetadataTestEntity);
      expect(entity).toBeDefined();
      expect(entity!.target).toBe(MetadataTestEntity);
    });

    it('should return undefined for unregistered entity', () => {
      class UnregisteredEntity {}
      const entity = MetadataStorage.getEntity(UnregisteredEntity);
      expect(entity).toBeUndefined();
    });
  });

  describe('manual metadata registration', () => {
    it('should allow manual entity registration', () => {
      class ManualEntity {}

      MetadataStorage.addEntity(ManualEntity, 'manual_table');

      const metadata = MetadataStorage.getEntity(ManualEntity);
      expect(metadata).toBeDefined();
      expect(metadata!.tableName).toBe('manual_table');
      expect(metadata!.target).toBe(ManualEntity);
    });

    it('should allow manual column registration', () => {
      class ManualEntity {}

      MetadataStorage.addEntity(ManualEntity);

      const columnMetadata: ColumnMetadata = {
        propertyName: 'manualColumn',
        columnName: 'manual_column',
        type: 'TEXT',
        nullable: true
      };

      MetadataStorage.addColumn(ManualEntity, columnMetadata);

      const metadata = MetadataStorage.getEntity(ManualEntity);
      expect(metadata!.columns).toHaveLength(1);
      expect(metadata!.columns[0]).toEqual(columnMetadata);
    });

    it('should allow manual primary key registration', () => {
      class ManualEntity {}

      MetadataStorage.addEntity(ManualEntity);
      MetadataStorage.addPrimaryKey(ManualEntity, 'id');

      const metadata = MetadataStorage.getEntity(ManualEntity);
      expect(metadata!.primaryKeys).toContain('id');
    });

    it('should allow manual relationship registration', () => {
      class ManualEntity {}
      class RelatedEntity {}

      MetadataStorage.addEntity(ManualEntity);
      MetadataStorage.addEntity(RelatedEntity);

      const relationshipMetadata: RelationshipMetadata = {
        propertyName: 'related',
        type: 'one-to-many',
        targetEntity: RelatedEntity
      };

      MetadataStorage.addRelationship(ManualEntity, relationshipMetadata);

      const metadata = MetadataStorage.getEntity(ManualEntity);
      expect(metadata!.relationships).toHaveLength(1);
      expect(metadata!.relationships[0]).toEqual(relationshipMetadata);
    });

    it('should allow manual index registration', () => {
      class ManualEntity {}

      MetadataStorage.addEntity(ManualEntity);
      // add referenced column to satisfy validation
      MetadataStorage.addColumn(ManualEntity, {
        propertyName: 'manualColumn',
        columnName: 'manual_column',
        type: 'TEXT',
        nullable: true
      } as unknown as ColumnMetadata);

      const indexMetadata: IndexMetadata = {
        name: 'idx_manual',
        columns: ['manual_column'],
        unique: true
      };

      MetadataStorage.addIndex(ManualEntity, indexMetadata);

      const metadata = MetadataStorage.getEntity(ManualEntity);
      expect(metadata!.indexes).toHaveLength(1);
      expect(metadata!.indexes[0]).toEqual(indexMetadata);
    });
  });

  describe('clear functionality', () => {
    it('should clear all metadata', () => {
      // Register some entities
      new MetadataTestEntity();
      new MetadataRelatedEntity();

      expect(MetadataStorage.getEntities()).toHaveLength(2);

      MetadataStorage.getInstance().clear();

      expect(MetadataStorage.getEntities()).toHaveLength(0);
      expect(MetadataStorage.getEntity(MetadataTestEntity)).toBeUndefined();
    });
  });

  describe('builder pattern integration', () => {
    it('should properly finalize entities when accessed', () => {
      // Add partial metadata without finalizing
      MetadataStorage.addEntity(MetadataTestEntity);

      const columnMetadata: ColumnMetadata = {
        propertyName: 'testColumn',
        columnName: 'test_column',
        type: 'TEXT',
        nullable: true
      };
      MetadataStorage.addColumn(MetadataTestEntity, columnMetadata);

      // Accessing the entity should finalize it
      const metadata = MetadataStorage.getEntity(MetadataTestEntity);
      expect(metadata).toBeDefined();
      expect(metadata!.columns).toHaveLength(1);
      expect(metadata!.columns[0]).toEqual(columnMetadata);
    });
  });
});
