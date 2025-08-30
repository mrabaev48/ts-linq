/**
 * Base class for defining database schema/data migrations.
 * Concrete migrations implement `up` and `down`, and expose name and version.
 */
export abstract class Migration {
    /** Apply the migration changes. */
    public abstract up(): Promise<void>;
    /** Revert the migration changes. */
    public abstract down(): Promise<void>;
    
    /** Human-readable migration name. */
    protected abstract get name(): string;
    /** Version identifier used for ordering and tracking. */
    protected abstract get version(): string;
    
    /** Get the migration name. */
    public getName(): string {
        return this.name;
    }
    
    /** Get the migration version identifier. */
    public getVersion(): string {
        return this.version;
    }
}
