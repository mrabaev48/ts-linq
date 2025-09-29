"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const mysql_1 = require("@ts-linq/mysql");
const DialectMigrationSql_1 = require("../src/migrations/DialectMigrationSql");
const MYSQL_URL = process.env.MYSQL_URL;
const maybe = MYSQL_URL ? describe : describe.skip;
maybe('MySQL advanced migrations (FK add, rename table)', () => {
    let p;
    beforeAll(async () => {
        p = new mysql_1.MySqlProvider(MYSQL_URL);
        await p.connect();
        await p.executeNonQuery('DROP TABLE IF EXISTS orders');
        await p.executeNonQuery('DROP TABLE IF EXISTS orders_renamed');
        await p.executeNonQuery('DROP TABLE IF EXISTS users');
        await p.executeNonQuery('CREATE TABLE users (id INT PRIMARY KEY, name TEXT NOT NULL)');
        await p.executeNonQuery('CREATE TABLE orders (id INT PRIMARY KEY, user_id INT NOT NULL)');
    });
    afterAll(async () => {
        try {
            await p.executeNonQuery('DROP TABLE IF EXISTS orders');
            await p.executeNonQuery('DROP TABLE IF EXISTS orders_renamed');
            await p.executeNonQuery('DROP TABLE IF EXISTS users');
        }
        catch (e) {
            // ignore cleanup errors in CI envs without full perms
        }
        await p.disconnect();
    });
    test('add FK and enforce referential integrity', async () => {
        const diff = {
            tables: [
                {
                    table: 'orders',
                    fkCreates: [
                        { columns: ['user_id'], refTable: 'users', refColumns: ['id'], onDelete: 'CASCADE' }
                    ]
                }
            ]
        };
        const { up } = (0, DialectMigrationSql_1.generateMigrationFromDiff)(diff, 'mysql');
        for (const sql of up)
            await p.executeNonQuery(sql);
        await p.executeNonQuery('INSERT INTO users (id,name) VALUES (?,?)', [1, 'u']);
        await expect(p.executeNonQuery('INSERT INTO orders (id,user_id) VALUES (?,?)', [1, 1])).resolves.toBe(1);
        await expect(p.executeNonQuery('INSERT INTO orders (id,user_id) VALUES (?,?)', [2, 999])).rejects.toBeTruthy();
    });
    test('rename table orders -> orders_renamed', async () => {
        const diff = { tables: [{ table: 'orders', renameTo: 'orders_renamed' }] };
        const { up } = (0, DialectMigrationSql_1.generateMigrationFromDiff)(diff, 'mysql');
        for (const sql of up)
            await p.executeNonQuery(sql);
        await expect(p.executeQuery('SELECT * FROM orders_renamed')).resolves.toBeDefined();
    });
});
//# sourceMappingURL=mysql-integration-migrations-advanced.test.js.map