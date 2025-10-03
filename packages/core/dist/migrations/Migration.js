"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration = void 0;
/**
 * Base class for defining database schema/data migrations.
 * Concrete migrations implement `up` and `down`, and expose name and version.
 */
class Migration {
    /** Get the migration name. */
    getName() {
        return this.name;
    }
    /** Get the migration version identifier. */
    getVersion() {
        return this.version;
    }
}
exports.Migration = Migration;
//# sourceMappingURL=Migration.js.map