"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const DbContext_1 = require("../../src/context/DbContext");
const MetadataStorage_1 = require("../../src/metadata/MetadataStorage");
const types_1 = require("../../src/types");
const DatabaseProvider_1 = require("../../src/DatabaseProvider");
const ValidIf_1 = require("../../src/decorators/ValidIf");
class ProviderStub extends DatabaseProvider_1.DatabaseProvider {
    constructor() {
        super('');
        this.providerName = 'test';
    }
    async connect() {
        this.isConnected = true;
    }
    async disconnect() {
        this.isConnected = false;
    }
    async createTable() {
        /* no-op */
    }
    getDialect() {
        return { buildSelect: () => ({ query: '', parameters: [] }) };
    }
    async insert(e) {
        return e;
    }
    async update(e) {
        return e;
    }
    async delete() {
        /* no-op */
    }
    async findById() {
        return null;
    }
    async findAll() {
        return [];
    }
    async findWhere() {
        return [];
    }
    async findWhereIn() {
        return [];
    }
    async doExecuteQuery() {
        return [];
    }
    async doExecuteNonQuery() {
        return 0;
    }
    async beginTransaction() {
        this.inTransaction = true;
    }
    async commitTransaction() {
        this.inTransaction = false;
    }
    async rollbackTransaction() {
        this.inTransaction = false;
    }
}
class Product {
}
class Ctx extends DbContext_1.DbContext {
    constructor() {
        super({ provider: new ProviderStub() });
    }
}
describe('Typed ValidIf helpers', () => {
    beforeEach(() => {
        MetadataStorage_1.MetadataStorage.getInstance().clear();
        MetadataStorage_1.MetadataStorage.addEntity(Product, 'Products');
        const cols = [
            { propertyName: 'id', columnName: 'id', type: 'INTEGER', nullable: false, isGenerated: true },
            // nullable true to allow conditional required rules (avoid base NotNull masking ValidIf)
            { propertyName: 'title', columnName: 'title', type: 'TEXT', nullable: true, length: 50 },
            { propertyName: 'price', columnName: 'price', type: 'NUMBER', nullable: false },
            { propertyName: 'status', columnName: 'status', type: 'TEXT', nullable: false }
        ];
        cols.forEach((c) => MetadataStorage_1.MetadataStorage.addColumn(Product, c));
        MetadataStorage_1.MetadataStorage.addPrimaryKey(Product, 'id');
        // Simulate decorators usage via metadata
        // 1) RequiredIf: title required when status is 'published'
        (0, ValidIf_1.RequiredIfOf)((p) => p.status === 'published')(undefined, {
            kind: 'field',
            name: 'title',
            addInitializer: (fn) => fn.call(Product.prototype)
        });
        // 2) RangeOf for price (>= 0)
        (0, ValidIf_1.RangeOf)(0)(undefined, {
            kind: 'field',
            name: 'price',
            addInitializer: (fn) => fn.call(Product.prototype)
        });
    });
    test('RequiredIfOf enforces conditionally', async () => {
        const ctx = new Ctx();
        const set = ctx.set(Product);
        const p = new Product();
        p.status = 'published';
        p.price = 10;
        // title is missing -> should fail
        set.add(p);
        await expect(ctx.saveChanges()).rejects.toBeInstanceOf(types_1.ValidationError);
        await ctx.dispose();
    });
    test('RangeOf validates numeric boundary', async () => {
        const ctx = new Ctx();
        const set = ctx.set(Product);
        const p = new Product();
        p.status = 'draft';
        p.title = 'ok';
        p.price = -1;
        set.add(p);
        await expect(ctx.saveChanges()).rejects.toBeInstanceOf(types_1.ValidationError);
        await ctx.dispose();
    });
    test('ValidIf supports phases and i18n translation', async () => {
        class TCtx extends Ctx {
            constructor() {
                super();
                this._validationOptions = {
                    translate: (k) => (k === 'err.title.required' ? 'Title required (i18n)' : k)
                };
            }
        }
        const ctx = new TCtx();
        const set = ctx.set(Product);
        // onCreate: required title when published
        (0, ValidIf_1.ValidIf)((e) => e.status !== 'published' || !!e.title, undefined, {
            phase: 'onCreate',
            messageKey: 'err.title.required'
        })(undefined, {
            kind: 'field',
            name: 'title',
            addInitializer: (fn) => fn.call(Product.prototype)
        });
        const p = new Product();
        p.status = 'published';
        p.price = 10;
        set.add(p);
        try {
            await ctx.saveChanges();
            fail('expected ValidationError');
        }
        catch (e) {
            const details = e?.details || [];
            const hasRequired = details.some((d) => /required/i.test(d.message));
            expect(hasRequired).toBe(true);
        }
        await ctx.dispose();
    });
});
//# sourceMappingURL=ValidIf.typed.test.js.map