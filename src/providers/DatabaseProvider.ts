import { EntityMetadata } from '../types';

export abstract class DatabaseProvider {
    protected connectionString: string;
    protected isConnected: boolean = false;
    protected inTransaction: boolean = false;

    constructor(connectionString: string) {
        this.connectionString = connectionString;
    }

    public abstract connect(): Promise<void>;
    public abstract disconnect(): Promise<void>;
    public abstract createTable(entityMetadata: EntityMetadata): Promise<void>;
    public abstract insert<T>(entity: T, entityClass: Function): Promise<T>;
    public abstract update<T>(entity: T, entityClass: Function): Promise<T>;
    public abstract delete<T>(entity: T, entityClass: Function): Promise<void>;
    public abstract findById<T>(id: any, entityClass: new () => T): Promise<T | null>;
    public abstract findAll<T>(entityClass: new () => T): Promise<T[]>;
    public abstract findWhere<T>(entityClass: new () => T, conditions: any): Promise<T[]>;
    public abstract executeQuery<T>(sql: string, params?: any[]): Promise<T[]>;
    public abstract executeNonQuery(sql: string, params?: any[]): Promise<number>;

    public abstract beginTransaction(): Promise<void>;
    public abstract commitTransaction(): Promise<void>;
    public abstract rollbackTransaction(): Promise<void>;

    public get connected(): boolean {
        return this.isConnected;
    }

    public get inTransactionState(): boolean {
        return this.inTransaction;
    }
}
