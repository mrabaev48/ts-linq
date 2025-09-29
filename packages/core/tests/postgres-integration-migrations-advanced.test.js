"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const postgres_1 = require("@ts-linq/postgres");
const DialectMigrationSql_1 = require("../src/migrations/DialectMigrationSql");
const PG_URL = process.env.POSTGRES_URL;
const maybe = PG_URL ? describe : describe.skip;
maybe('PostgreSQL advanced migrations (FK add, rename table)', () => {
    let p;
    beforeAll(async () => {
        p = new postgres_1.PostgresProvider(PG_URL);
        await p.connect();
        await p.executeNonQuery('DROP TABLE IF EXISTS "orders"');
        await p.executeNonQuery('DROP TABLE IF EXISTS "orders_renamed"');
        await p.executeNonQuery('DROP TABLE IF EXISTS "users"');
        await p.executeNonQuery('CREATE TABLE "users" ("id" INTEGER PRIMARY KEY, "name" TEXT NOT NULL)');
        await p.executeNonQuery('CREATE TABLE "orders" ("id" INTEGER PRIMARY KEY, "user_id" INTEGER NOT NULL)');
    });
    afterAll(async () => {
        try {
            await p.executeNonQuery('DROP TABLE IF EXISTS "orders"');
            await p.executeNonQuery('DROP TABLE IF EXISTS "orders_renamed"');
            await p.executeNonQuery('DROP TABLE IF EXISTS "users"');
        }
        catch (e) {
            // ignore cleanup in CI
        }
        await p.disconnect();
    });
    test('add FK and enforce referential integrity', async () => {
        const diff = {
            tables: [
                {
                    table: 'orders',
                    fkCreates: [
                        {
                            name: 'fk_orders_users',
                            columns: ['user_id'],
                            refTable: 'users',
                            refColumns: ['id'],
                            onDelete: 'CASCADE'
                        }
                    ]
                }
            ]
        };
        const { up } = (0, DialectMigrationSql_1.generateMigrationFromDiff)(diff, 'postgresql');
        for (const sql of up)
            await p.executeNonQuery(sql);
        await p.executeNonQuery('INSERT INTO "users" ("id","name") VALUES ($1,$2)', [1, 'u']);
        await expect(p.executeNonQuery('INSERT INTO "orders" ("id","user_id") VALUES ($1,$2)', [1, 1])).resolves.toBe(1);
        await expect(p.executeNonQuery('INSERT INTO "orders" ("id","user_id") VALUES ($1,$2)', [2, 999])).rejects.toBeTruthy();
    });
    test('rename table orders -> orders_renamed', async () => {
        const diff = { tables: [{ table: 'orders', renameTo: 'orders_renamed' }] };
        const { up } = (0, DialectMigrationSql_1.generateMigrationFromDiff)(diff, 'postgresql');
        for (const sql of up)
            await p.executeNonQuery(sql);
        await expect(p.executeQuery('SELECT * FROM "orders_renamed"')).resolves.toBeDefined();
    });
});
//# sourceMappingURL=postgres-integration-migrations-advanced.test.js.map