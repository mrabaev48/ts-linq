"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiffBasedMigration = void 0;
const Migration_1 = require("./Migration");
const DialectMigrationSql_1 = require("./DialectMigrationSql");
/**
 * Template Method-style base for migrations that are generated from a SchemaDiff.
 * Subclasses provide diff() and dialect(), and this class implements up()/down().
 */
class DiffBasedMigration extends Migration_1.Migration {
    /** Hook before executing all UP statements. */
    async beforeUp(_sqls) { }
    /** Hook after executing all UP statements. */
    async afterUp(_sqls) { }
    /** Hook before executing a single UP statement; return false to skip. */
    async beforeUpStatement(_sql) {
        return true;
    }
    /** Hook after executing a single UP statement. */
    async afterUpStatement(_sql) { }
    /** Hook before executing all DOWN statements. */
    async beforeDown(_sqls) { }
    /** Hook after executing all DOWN statements. */
    async afterDown(_sqls) { }
    /** Hook before executing a single DOWN statement; return false to skip. */
    async beforeDownStatement(_sql) {
        return true;
    }
    /** Hook after executing a single DOWN statement. */
    async afterDownStatement(_sql) { }
    async up() {
        const schemaDiff = await this.diff();
        const { up } = (0, DialectMigrationSql_1.generateMigrationFromDiff)(schemaDiff, this.dialect());
        await this.beforeUp(up);
        for (const sql of up) {
            if (!(await this.beforeUpStatement(sql)))
                continue;
            await this.provider.executeNonQuery(sql);
            await this.afterUpStatement(sql);
        }
        await this.afterUp(up);
    }
    async down() {
        const schemaDiff = await this.diff();
        const { down } = (0, DialectMigrationSql_1.generateMigrationFromDiff)(schemaDiff, this.dialect());
        await this.beforeDown(down);
        for (const sql of down) {
            if (!(await this.beforeDownStatement(sql)))
                continue;
            await this.provider.executeNonQuery(sql);
            await this.afterDownStatement(sql);
        }
        await this.afterDown(down);
    }
}
exports.DiffBasedMigration = DiffBasedMigration;
//# sourceMappingURL=DiffBasedMigration.js.map