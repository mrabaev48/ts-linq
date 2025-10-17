import type { TsLinqConfig, DatabaseConfig, MigrationsConfig } from './types';

export class ConfigBuilder {
  private config: Partial<TsLinqConfig> = {};

  database(config: DatabaseConfig): this {
    this.config.database = config;
    return this;
  }

  migrations(config: MigrationsConfig): this {
    this.config.migrations = config;
    return this;
  }

  entities(directory: string, pattern?: string): this {
    this.config.entities = {
      directory,
      pattern: pattern || '**/*.entity.ts'
    };
    return this;
  }

  cli(migrationsDir?: string, entitiesDir?: string): this {
    this.config.cli = {
      migrationsDir: migrationsDir || './migrations',
      entitiesDir: entitiesDir || './src/entities'
    };
    return this;
  }

  logging(level?: 'debug' | 'info' | 'warn' | 'error', sql?: boolean): this {
    this.config.logging = {
      level: level || 'info',
      sql: sql !== undefined ? sql : false
    };
    return this;
  }

  cache(enabled: boolean, provider?: 'memory' | 'redis' | 'memcached'): this {
    this.config.cache = {
      enabled,
      provider: provider || 'memory'
    };
    return this;
  }

  environment(name: string, overrides: Partial<TsLinqConfig>): this {
    if (!this.config.environments) {
      this.config.environments = {};
    }
    this.config.environments[name] = overrides;
    return this;
  }

  build(): TsLinqConfig {
    if (!this.config.database) {
      throw new Error('Database configuration is required');
    }
    return this.config as TsLinqConfig;
  }

  // Helper methods for common configurations
  static sqlite(database: string): ConfigBuilder {
    return new ConfigBuilder().database({
      provider: 'sqlite',
      connection: database
    });
  }

  static postgres(connection: string): ConfigBuilder {
    return new ConfigBuilder().database({
      provider: 'postgres',
      connection
    });
  }

  static mysql(connection: string | object): ConfigBuilder {
    return new ConfigBuilder().database({
      provider: 'mysql',
      connection
    });
  }

  static mssql(connection: string | object): ConfigBuilder {
    return new ConfigBuilder().database({
      provider: 'mssql',
      connection
    });
  }
}
