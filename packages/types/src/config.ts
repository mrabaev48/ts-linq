// Connection, pool and provider configuration

import type { SqlLogger } from './logging';
import type { OrmMiddleware, RetryPolicy } from './middleware';

// Connection options
export interface ConnectionPoolOptions {
  min?: number;
  max?: number;
  idleTimeoutMs?: number;
  connectionTimeoutMs?: number;
  acquireTimeoutMs?: number;
}

export interface ConnectionHealthCheckOptions {
  enabled?: boolean;
  intervalMs?: number;
  timeoutMs?: number;
  testQuery?: string;
  minIntervalMs?: number;
  maxIntervalMs?: number;
  degradeAfterFailures?: number;
  unhealthyAfterFailures?: number;
}

// Soft delete options
export interface SoftDeleteOptions {
  enabled?: boolean;
  column?: string;
  columnName?: string;
  /** Optional timestamp column used by timestamp-based soft delete. */
  deletedAtColumn?: string;
  type?: 'boolean' | 'timestamp';
}

// Base provider configuration
export interface BaseProviderConfig {
  logger?: SqlLogger;
  middlewares?: OrmMiddleware[];
  softDelete?: SoftDeleteOptions;
  retryPolicy?: RetryPolicy;
  poolOptions?: ConnectionPoolOptions;
  healthCheck?: ConnectionHealthCheckOptions;
}

// PostgreSQL provider configuration
export interface PostgresConfig extends BaseProviderConfig {
  host: string;
  port?: number;
  database: string;
  user: string;
  password?: string;
  ssl?: boolean | object;
  applicationName?: string;
  schema?: string;
  connectionTimeoutMs?: number;
  /** Optional: Inject existing pg.Pool instance */
  pool?: object;
}

// MySQL provider configuration
export interface MySqlConfig extends BaseProviderConfig {
  host: string;
  port?: number;
  user: string;
  password?: string;
  database: string;
  socketPath?: string;
  charset?: string;
  timezone?: string;
  /** Optional: Inject existing mysql2 Pool instance */
  pool?: object;
}

// MSSQL provider configuration
export interface MssqlConfig extends BaseProviderConfig {
  server: string;
  port?: number;
  database: string;
  user?: string;
  password?: string;
  domain?: string;
  encrypt?: boolean;
  trustServerCertificate?: boolean;
  integratedSecurity?: boolean;
  instanceName?: string;
  connectionTimeout?: number;
  applicationName?: string;
  options?: Record<string, unknown>;
  /** Optional: Inject existing mssql ConnectionPool instance */
  pool?: object;
}

// Audit options
export interface AuditOptions {
  enabled?: boolean;
  createdAtColumn?: string;
  updatedAtColumn?: string;
  createdByColumn?: string;
  updatedByColumn?: string;
  getCurrentUser?: () => string | number | Promise<string | number>;
  clock?: () => Date;
  timeColumns?: {
    createdAt?: string;
    updatedAt?: string;
  };
  userColumns?: {
    createdBy?: string;
    updatedBy?: string;
  };
}

export interface SoftDeleteOptionsExtended extends SoftDeleteOptions {
  // Backward compatible alias; all fields live in SoftDeleteOptions.
}
