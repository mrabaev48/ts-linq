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
    beforeUp(_sqls) { }
    /** Hook after executing all UP statements. */
    afterUp(_sqls) { }
    /** Hook before executing a single UP statement; return false to skip. */
    beforeUpStatement(_sql) {
        return true;
    }
    /** Hook after executing a single UP statement. */
    afterUpStatement(_sql) { }
    /** Hook before executing all DOWN statements. */
    beforeDown(_sqls) { }
    /** Hook after executing all DOWN statements. */
    afterDown(_sqls) { }
    /** Hook before executing a single DOWN statement; return false to skip. */
    beforeDownStatement(_sql) {
        return true;
    }
    /** Hook after executing a single DOWN statement. */
    afterDownStatement(_sql) { }
    async up() {
        const schemaDiff = await this.diff();
        const { up } = (0, DialectMigrationSql_1.generateMigrationFromDiff)(schemaDiff, this.dialect());
        this.beforeUp(up);
        for (const sql of up) {
            if (!this.beforeUpStatement(sql))
                continue;
            await this.provider.executeNonQuery(sql);
            this.afterUpStatement(sql);
        }
        this.afterUp(up);
    }
    async down() {
        const schemaDiff = await this.diff();
        const { down } = (0, DialectMigrationSql_1.generateMigrationFromDiff)(schemaDiff, this.dialect());
        this.beforeDown(down);
        for (const sql of down) {
            if (!this.beforeDownStatement(sql))
                continue;
            await this.provider.executeNonQuery(sql);
            this.afterDownStatement(sql);
        }
        this.afterDown(down);
    }
}
exports.DiffBasedMigration = DiffBasedMigration;
//# sourceMappingURL=DiffBasedMigration.js.map