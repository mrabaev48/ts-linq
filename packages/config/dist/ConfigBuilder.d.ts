import type { TsLinqConfig, DatabaseConfig, MigrationsConfig } from './types';
export declare class ConfigBuilder {
    private config;
    database(config: DatabaseConfig): this;
    migrations(config: MigrationsConfig): this;
    entities(directory: string, pattern?: string): this;
    cli(migrationsDir?: string, entitiesDir?: string): this;
    logging(level?: 'debug' | 'info' | 'warn' | 'error', sql?: boolean): this;
    cache(enabled: boolean, provider?: 'memory' | 'redis' | 'memcached'): this;
    environment(name: string, overrides: Partial<TsLinqConfig>): this;
    build(): TsLinqConfig;
    static sqlite(database: string): ConfigBuilder;
    static postgres(connection: string): ConfigBuilder;
    static mysql(connection: string | object): ConfigBuilder;
    static mssql(connection: string | object): ConfigBuilder;
}
//# sourceMappingURL=ConfigBuilder.d.ts.map