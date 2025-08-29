export abstract class Migration {
    public abstract up(): Promise<void>;
    public abstract down(): Promise<void>;
    
    protected abstract get name(): string;
    protected abstract get version(): string;
    
    public getName(): string {
        return this.name;
    }
    
    public getVersion(): string {
        return this.version;
    }
}
