/**
 * Base class for defining database schema/data migrations.
 * Concrete migrations implement `up` and `down`, and expose name and version.
 */
export class Migration {
    /** Get the migration name. */
    getName() {
        return this.name;
    }
    /** Get the migration version identifier. */
    getVersion() {
        return this.version;
    }
}
//# sourceMappingURL=Migration.js.map