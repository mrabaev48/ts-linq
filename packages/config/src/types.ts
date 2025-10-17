export interface DatabaseConfig {
  provider: 'sqlite' | 'postgres' | 'mysql' | 'mssql';
  connection: string | {
    host?: string;
    port?: number;
    database?: string;
    user?: string;
    password?: string;
    ssl?: boolean;
  };
  pool?: {
    min?: number;
    max?: number;
    acquireTimeoutMillis?: number;
    idleTimeoutMillis?: number;
  };
}

export interface MigrationsConfig {
  directory?: string;
  tableName?: string;
  pattern?: string;
  transactional?: boolean;
}

export interface EntitiesConfig {
  directory?: string;
  pattern?: string;
}

export interface CliConfig {
  migrationsDir?: string;
  entitiesDir?: string;
  seedsDir?: string;
}

export interface LoggingConfig {
  level?: 'debug' | 'info' | 'warn' | 'error';
  sql?: boolean;
  slowQueryThreshold?: number;
}

export interface CacheConfig {
  enabled?: boolean;
  provider?: 'memory' | 'redis' | 'memcached';
  ttl?: number;
  connection?: string;
}

export interface TsLinqConfig {
  database: DatabaseConfig;
  migrations?: MigrationsConfig;
  entities?: EntitiesConfig;
  cli?: CliConfig;
  logging?: LoggingConfig;
  cache?: CacheConfig;
  
  // Environment-specific overrides
  environments?: {
    [key: string]: Partial<TsLinqConfig>;
  };
}

export interface ConfigOptions {
  configPath?: string;
  environment?: string;
  validate?: boolean;
}
