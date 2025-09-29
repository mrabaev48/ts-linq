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
const src_1 = require("../src");
const MetadataStorage_1 = require("../src/metadata/MetadataStorage");
describe('Decorators', () => {
    beforeEach(() => {
        MetadataStorage_1.MetadataStorage.getInstance().clear();
    });
    describe('@Entity', () => {
        it('should register entity metadata', () => {
            let TestEntity = class TestEntity {
            };
            TestEntity = __decorate([
                (0, src_1.Entity)()
            ], TestEntity);
            const metadata = MetadataStorage_1.MetadataStorage.getEntity(TestEntity);
            expect(metadata).toBeDefined();
            expect(metadata.tableName).toBe('TestEntity');
        });
        it('should use custom table name', () => {
            let TestEntity = class TestEntity {
            };
            TestEntity = __decorate([
                (0, src_1.Entity)({ name: 'custom_table' })
            ], TestEntity);
            const metadata = MetadataStorage_1.MetadataStorage.getEntity(TestEntity);
            expect(metadata.tableName).toBe('custom_table');
        });
    });
    describe('@Column', () => {
        it('should register column metadata', () => {
            let TestEntity = class TestEntity {
            };
            __decorate([
                (0, src_1.Column)(),
                __metadata("design:type", String)
            ], TestEntity.prototype, "name", void 0);
            TestEntity = __decorate([
                (0, src_1.Entity)()
            ], TestEntity);
            // instantiate to trigger Stage-3 field initializers
            new TestEntity();
            const metadata = MetadataStorage_1.MetadataStorage.getEntity(TestEntity);
            expect(metadata.columns).toHaveLength(1);
            expect(metadata.columns[0].propertyName).toBe('name');
            expect(metadata.columns[0].columnName).toBe('name');
        });
        it('should use custom column options', () => {
            let TestEntity = class TestEntity {
            };
            __decorate([
                (0, src_1.Column)({ name: 'full_name', type: 'VARCHAR', length: 255, nullable: false }),
                __metadata("design:type", String)
            ], TestEntity.prototype, "name", void 0);
            TestEntity = __decorate([
                (0, src_1.Entity)()
            ], TestEntity);
            new TestEntity();
            const metadata = MetadataStorage_1.MetadataStorage.getEntity(TestEntity);
            const column = metadata.columns[0];
            expect(column.columnName).toBe('full_name');
            expect(column.type).toBe('VARCHAR');
            expect(column.length).toBe(255);
            expect(column.nullable).toBe(false);
        });
    });
    describe('@PrimaryKey', () => {
        it('should register primary key', () => {
            let TestEntity = class TestEntity {
            };
            __decorate([
                (0, src_1.PrimaryKey)(),
                __metadata("design:type", Number)
            ], TestEntity.prototype, "id", void 0);
            TestEntity = __decorate([
                (0, src_1.Entity)()
            ], TestEntity);
            new TestEntity();
            const metadata = MetadataStorage_1.MetadataStorage.getEntity(TestEntity);
            expect(metadata.primaryKeys).toContain('id');
            expect(metadata.columns[0].nullable).toBe(false);
        });
        it('should support auto increment', () => {
            let TestEntity = class TestEntity {
            };
            __decorate([
                (0, src_1.PrimaryKey)({ autoIncrement: true }),
                __metadata("design:type", Number)
            ], TestEntity.prototype, "id", void 0);
            TestEntity = __decorate([
                (0, src_1.Entity)()
            ], TestEntity);
            new TestEntity();
            const metadata = MetadataStorage_1.MetadataStorage.getEntity(TestEntity);
            expect(metadata.columns[0].isGenerated).toBe(true);
        });
    });
    describe('Relationship decorators', () => {
        it('should register one-to-many relationship', () => {
            let User = class User {
            };
            __decorate([
                (0, src_1.PrimaryKey)(),
                __metadata("design:type", Number)
            ], User.prototype, "id", void 0);
            __decorate([
                (0, src_1.OneToMany)(() => Post),
                __metadata("design:type", Array)
            ], User.prototype, "posts", void 0);
            User = __decorate([
                (0, src_1.Entity)()
            ], User);
            let Post = class Post {
            };
            __decorate([
                (0, src_1.PrimaryKey)(),
                __metadata("design:type", Number)
            ], Post.prototype, "id", void 0);
            __decorate([
                (0, src_1.ManyToOne)(() => User),
                __metadata("design:type", User)
            ], Post.prototype, "user", void 0);
            Post = __decorate([
                (0, src_1.Entity)()
            ], Post);
            // instantiate to ensure metadata finalized
            new User();
            new Post();
            const userMetadata = MetadataStorage_1.MetadataStorage.getEntity(User);
            const postMetadata = MetadataStorage_1.MetadataStorage.getEntity(Post);
            expect(userMetadata.relationships).toHaveLength(1);
            expect(userMetadata.relationships[0].type).toBe('one-to-many');
            const userTargetEntity = userMetadata.relationships[0].targetEntity;
            expect(userTargetEntity).toBe(Post);
            expect(postMetadata.relationships).toHaveLength(1);
            expect(postMetadata.relationships[0].type).toBe('many-to-one');
            const postTargetEntity = postMetadata.relationships[0].targetEntity;
            expect(postTargetEntity).toBe(User);
        });
    });
});
//# sourceMappingURL=decorators.test.js.map