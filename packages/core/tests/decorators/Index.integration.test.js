"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
const MetadataStorage_1 = require("../../src/metadata/MetadataStorage");
const decorators_1 = require("../../src/decorators");
let User = class User {
};
User = __decorate([
    (0, decorators_1.Index)(new decorators_1.IndexOptionsBuilder('idx_users_email_created')
        .onColumns(['email', 'createdAt'])
        .unique()
        .orderBy({ email: 'ASC', createdAt: 'DESC' }))
], User);
test('Index decorator accepts IndexOptionsBuilder and registers metadata', () => {
    MetadataStorage_1.MetadataStorage.getInstance().clear();
    MetadataStorage_1.MetadataStorage.addEntity(User, 'Users');
    const cols = [
        { propertyName: 'id', columnName: 'id', type: 'INTEGER', nullable: false },
        { propertyName: 'email', columnName: 'email', type: 'TEXT', nullable: false },
        { propertyName: 'createdAt', columnName: 'createdAt', type: 'TEXT', nullable: false }
    ];
    cols.forEach((c) => MetadataStorage_1.MetadataStorage.addColumn(User, c));
    MetadataStorage_1.MetadataStorage.addPrimaryKey(User, 'id');
    // Trigger class initializer by instantiation (for Stage-3 addInitializer)
    // and then synchronize via @Entity initializer simulation
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _user = new User();
    const ctor = User;
    const pendingIndexes = Reflect.getOwnMetadata('orm:indexes', ctor) || [];
    for (const idx of pendingIndexes) {
        MetadataStorage_1.MetadataStorage.addIndex(User, idx);
    }
    const meta = MetadataStorage_1.MetadataStorage.getEntity(User);
    expect(meta.indexes.length).toBeGreaterThan(0);
    const idx = meta.indexes.find((i) => i.name === 'idx_users_email_created');
    expect(idx).toBeDefined();
    expect(idx.columns).toEqual(['email', 'createdAt']);
    expect(idx.unique).toBe(true);
    expect(idx.orders).toEqual({ email: 'ASC', createdAt: 'DESC' });
});
//# sourceMappingURL=Index.integration.test.js.map