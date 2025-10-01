/**
 * Base class for defining database schema/data migrations.
 * Concrete migrations implement `up` and `down`, and expose name and version.
 */
export declare abstract class Migration {
    /** Apply the migration changes. */
    abstract up(): Promise<void>;
    /** Revert the migration changes. */
    abstract down(): Promise<void>;
    /** Human-readable migration name. */
    protected abstract get name(): string;
    /** Version identifier used for ordering and tracking. */
    protected abstract get version(): string;
    /** Get the migration name. */
    getName(): string;
    /** Get the migration version identifier. */
    getVersion(): string;
}
//# sourceMappingURL=Migration.d.ts.map