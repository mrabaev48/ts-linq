"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const MetadataStorage_1 = require("../src/metadata/MetadataStorage");
const src_1 = require("../src");
let MetadataTestEntity = class MetadataTestEntity {
};
__decorate([
    (0, src_1.PrimaryKey)({ autoIncrement: true }),
    __metadata("design:type", Number)
], MetadataTestEntity.prototype, "id", void 0);
__decorate([
    (0, src_1.Column)({ nullable: false }),
    __metadata("design:type", String)
], MetadataTestEntity.prototype, "name", void 0);
__decorate([
    (0, src_1.Column)(),
    __metadata("design:type", String)
], MetadataTestEntity.prototype, "email", void 0);
__decorate([
    (0, src_1.OneToMany)(() => MetadataRelatedEntity),
    __metadata("design:type", Array)
], MetadataTestEntity.prototype, "related", void 0);
MetadataTestEntity = __decorate([
    (0, src_1.Entity)()
], MetadataTestEntity);
let MetadataRelatedEntity = class MetadataRelatedEntity {
};
__decorate([
    (0, src_1.PrimaryKey)(),
    __metadata("design:type", Number)
], MetadataRelatedEntity.prototype, "id", void 0);
__decorate([
    (0, src_1.Column)(),
    __metadata("design:type", String)
], MetadataRelatedEntity.prototype, "title", void 0);
MetadataRelatedEntity = __decorate([
    (0, src_1.Entity)({ name: 'custom_related_table' })
], MetadataRelatedEntity);
describe('MetadataStorage', () => {
    beforeEach(() => {
        MetadataStorage_1.MetadataStorage.getInstance().clear();
    });
    describe('singleton pattern', () => {
        it('should return the same instance', () => {
            const instance1 = MetadataStorage_1.MetadataStorage.getInstance();
            const instance2 = MetadataStorage_1.MetadataStorage.getInstance();
            expect(instance1).toBe(instance2);
        });
    });
    describe('entity registration', () => {
        it('should register entity with decorators', () => {
            // Force metadata registration by creating instance
            new MetadataTestEntity();
            new MetadataRelatedEntity();
            const testEntityMetadata = MetadataStorage_1.MetadataStorage.getEntity(MetadataTestEntity);
            const relatedEntityMetadata = MetadataStorage_1.MetadataStorage.getEntity(MetadataRelatedEntity);
            expect(testEntityMetadata).toBeDefined();
            expect(testEntityMetadata.tableName).toBe('MetadataTestEntity');
            expect(testEntityMetadata.target).toBe(MetadataTestEntity);
            expect(relatedEntityMetadata).toBeDefined();
            // For stage-3, table name should be from decorator
            expect(relatedEntityMetadata.tableName).toBe('custom_related_table');
            expect(relatedEntityMetadata.target).toBe(MetadataRelatedEntity);
        });
        it('should register columns with metadata', () => {
            new MetadataTestEntity();
            const metadata = MetadataStorage_1.MetadataStorage.getEntity(MetadataTestEntity);
            expect(metadata.columns).toHaveLength(3);
            const idColumn = metadata.columns.find((c) => c.propertyName === 'id');
            expect(idColumn).toBeDefined();
            expect(idColumn.isGenerated).toBe(true);
            expect(idColumn.nullable).toBe(false);
            const nameColumn = metadata.columns.find((c) => c.propertyName === 'name');
            expect(nameColumn).toBeDefined();
            expect(nameColumn.nullable).toBe(false);
            const emailColumn = metadata.columns.find((c) => c.propertyName === 'email');
            expect(emailColumn).toBeDefined();
            expect(emailColumn.nullable).toBe(true); // Default nullable
        });
        it('should register primary keys', () => {
            new MetadataTestEntity();
            const metadata = MetadataStorage_1.MetadataStorage.getEntity(MetadataTestEntity);
            expect(metadata.primaryKeys).toContain('id');
            expect(metadata.primaryKeys).toHaveLength(1);
        });
        it('should register relationships', () => {
            new MetadataTestEntity();
            const metadata = MetadataStorage_1.MetadataStorage.getEntity(MetadataTestEntity);
            expect(metadata.relationships).toHaveLength(1);
            const relationship = metadata.relationships[0];
            expect(relationship.propertyName).toBe('related');
            expect(relationship.type).toBe('one-to-many');
            const target = typeof relationship.targetEntity === 'function'
                ? relationship.targetEntity
                : relationship.targetEntity();
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
            const entities = MetadataStorage_1.MetadataStorage.getEntities();
            expect(entities).toHaveLength(2);
            const entityNames = entities.map((e) => e.target.name);
            expect(entityNames).toContain('MetadataTestEntity');
            expect(entityNames).toContain('MetadataRelatedEntity');
        });
        it('should get specific entity', () => {
            const entity = MetadataStorage_1.MetadataStorage.getEntity(MetadataTestEntity);
            expect(entity).toBeDefined();
            expect(entity.target).toBe(MetadataTestEntity);
        });
        it('should return undefined for unregistered entity', () => {
            class UnregisteredEntity {
            }
            const entity = MetadataStorage_1.MetadataStorage.getEntity(UnregisteredEntity);
            expect(entity).toBeUndefined();
        });
    });
    describe('manual metadata registration', () => {
        it('should allow manual entity registration', () => {
            class ManualEntity {
            }
            MetadataStorage_1.MetadataStorage.addEntity(ManualEntity, 'manual_table');
            const metadata = MetadataStorage_1.MetadataStorage.getEntity(ManualEntity);
            expect(metadata).toBeDefined();
            expect(metadata.tableName).toBe('manual_table');
            expect(metadata.target).toBe(ManualEntity);
        });
        it('should allow manual column registration', () => {
            class ManualEntity {
            }
            MetadataStorage_1.MetadataStorage.addEntity(ManualEntity);
            const columnMetadata = {
                propertyName: 'manualColumn',
                columnName: 'manual_column',
                type: 'TEXT',
                nullable: true
            };
            MetadataStorage_1.MetadataStorage.addColumn(ManualEntity, columnMetadata);
            const metadata = MetadataStorage_1.MetadataStorage.getEntity(ManualEntity);
            expect(metadata.columns).toHaveLength(1);
            expect(metadata.columns[0]).toEqual(columnMetadata);
        });
        it('should allow manual primary key registration', () => {
            class ManualEntity {
            }
            MetadataStorage_1.MetadataStorage.addEntity(ManualEntity);
            MetadataStorage_1.MetadataStorage.addPrimaryKey(ManualEntity, 'id');
            const metadata = MetadataStorage_1.MetadataStorage.getEntity(ManualEntity);
            expect(metadata.primaryKeys).toContain('id');
        });
        it('should allow manual relationship registration', () => {
            class ManualEntity {
            }
            class RelatedEntity {
            }
            MetadataStorage_1.MetadataStorage.addEntity(ManualEntity);
            MetadataStorage_1.MetadataStorage.addEntity(RelatedEntity);
            const relationshipMetadata = {
                propertyName: 'related',
                type: 'one-to-many',
                targetEntity: RelatedEntity
            };
            MetadataStorage_1.MetadataStorage.addRelationship(ManualEntity, relationshipMetadata);
            const metadata = MetadataStorage_1.MetadataStorage.getEntity(ManualEntity);
            expect(metadata.relationships).toHaveLength(1);
            expect(metadata.relationships[0]).toEqual(relationshipMetadata);
        });
        it('should allow manual index registration', () => {
            class ManualEntity {
            }
            MetadataStorage_1.MetadataStorage.addEntity(ManualEntity);
            // add referenced column to satisfy validation
            MetadataStorage_1.MetadataStorage.addColumn(ManualEntity, {
                propertyName: 'manualColumn',
                columnName: 'manual_column',
                type: 'TEXT',
                nullable: true
            });
            const indexMetadata = {
                name: 'idx_manual',
                columns: ['manual_column'],
                unique: true
            };
            MetadataStorage_1.MetadataStorage.addIndex(ManualEntity, indexMetadata);
            const metadata = MetadataStorage_1.MetadataStorage.getEntity(ManualEntity);
            expect(metadata.indexes).toHaveLength(1);
            expect(metadata.indexes[0]).toEqual(indexMetadata);
        });
    });
    describe('clear functionality', () => {
        it('should clear all metadata', () => {
            // Register some entities
            new MetadataTestEntity();
            new MetadataRelatedEntity();
            expect(MetadataStorage_1.MetadataStorage.getEntities()).toHaveLength(2);
            MetadataStorage_1.MetadataStorage.getInstance().clear();
            expect(MetadataStorage_1.MetadataStorage.getEntities()).toHaveLength(0);
            expect(MetadataStorage_1.MetadataStorage.getEntity(MetadataTestEntity)).toBeUndefined();
        });
    });
    describe('builder pattern integration', () => {
        it('should properly finalize entities when accessed', () => {
            // Add partial metadata without finalizing
            MetadataStorage_1.MetadataStorage.addEntity(MetadataTestEntity);
            const columnMetadata = {
                propertyName: 'testColumn',
                columnName: 'test_column',
                type: 'TEXT',
                nullable: true
            };
            MetadataStorage_1.MetadataStorage.addColumn(MetadataTestEntity, columnMetadata);
            // Accessing the entity should finalize it
            const metadata = MetadataStorage_1.MetadataStorage.getEntity(MetadataTestEntity);
            expect(metadata).toBeDefined();
            expect(metadata.columns).toHaveLength(1);
            expect(metadata.columns[0]).toEqual(columnMetadata);
        });
    });
});
//# sourceMappingURL=metadata-storage.test.js.map