import { EntityMetadata } from '../types';

/**
 * Abstract base class for database providers. Concrete providers must
 * implement all abstract methods to support connections, CRUD operations,
 * simple querying and transaction management.
 */
export abstract class DatabaseProvider {
    protected connectionString: string;
    protected isConnected: boolean = false;
    protected inTransaction: boolean = false;

    /**
     * Create a provider with a given connection string.
     * @param connectionString Provider-specific connection string.
     */
    constructor(connectionString: string) {
        this.connectionString = connectionString;
    }

    /** Connect to the database. */
    public abstract connect(): Promise<void>;
    /** Disconnect from the database and release resources. */
    public abstract disconnect(): Promise<void>;
    /** Create a table for the provided entity metadata if it does not exist. */
    public abstract createTable(entityMetadata: EntityMetadata): Promise<void>;
    /** Insert an entity instance into its table and return the inserted entity. */
    public abstract insert<T>(entity: T, entityClass: Function): Promise<T>;
    /** Update an existing entity row and return the updated entity. */
    public abstract update<T>(entity: T, entityClass: Function): Promise<T>;
    /** Delete an entity row. */
    public abstract delete<T>(entity: T, entityClass: Function): Promise<void>;
    /** Find an entity by primary key value. */
    public abstract findById<T>(id: any, entityClass: new () => T): Promise<T | null>;
    /** Get all entities of a given type. */
    public abstract findAll<T>(entityClass: new () => T): Promise<T[]>;
    /** Find entities by a simple conditions object (key/value pairs). */
    public abstract findWhere<T>(entityClass: new () => T, conditions: any): Promise<T[]>;
    /** Execute a SQL query and return rows mapped as generic objects. */
    public abstract executeQuery<T>(sql: string, params?: any[]): Promise<T[]>;
    /** Execute a non-query SQL statement and return affected row count. */
    public abstract executeNonQuery(sql: string, params?: any[]): Promise<number>;

    /** Begin a transaction. */
    public abstract beginTransaction(): Promise<void>;
    /** Commit the current transaction. */
    public abstract commitTransaction(): Promise<void>;
    /** Roll back the current transaction. */
    public abstract rollbackTransaction(): Promise<void>;

    /**
     * Whether the provider is currently connected.
     */
    public get connected(): boolean {
        return this.isConnected;
    }

    /**
     * Whether a transaction is currently in progress.
     */
    public get inTransactionState(): boolean {
        return this.inTransaction;
    }
}
