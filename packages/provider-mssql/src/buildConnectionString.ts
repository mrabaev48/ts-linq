import type { MssqlConfig } from '@ts-linq/types';

/**
 * Builds MSSQL connection string from configuration object.
 *
 * @param config - MSSQL configuration
 * @returns Connection string in ADO.NET format (Server=...;Database=...)
 *
 * @example
 * buildMssqlConnectionString({
 *   server: 'localhost',
 *   database: 'mydb',
 *   user: 'sa',
 *   password: 'Password123'
 * }) // => 'Server=localhost;Database=mydb;User Id=sa;Password=Password123;'
 */
export function buildMssqlConnectionString(config: MssqlConfig): string {
  const parts: string[] = [];

  // Server and instance
  let serverPart = config.server;
  if (config.instanceName) {
    serverPart += `\\${config.instanceName}`;
  }
  if (config.port) {
    serverPart += `,${config.port}`;
  }
  parts.push(`Server=${serverPart}`);

  // Database
  parts.push(`Database=${config.database}`);

  // Authentication
  if (config.integratedSecurity) {
    parts.push('Integrated Security=true');
  } else if (config.user) {
    parts.push(`User Id=${config.user}`);
    if (config.password) {
      parts.push(`Password=${config.password}`);
    }
  }

  // Domain for Windows auth
  if (config.domain) {
    parts.push(`Domain=${config.domain}`);
  }

  // Encryption settings
  if (config.encrypt !== undefined) {
    parts.push(`Encrypt=${config.encrypt}`);
  }

  if (config.trustServerCertificate !== undefined) {
    parts.push(`TrustServerCertificate=${config.trustServerCertificate}`);
  }

  // Connection timeout
  if (config.connectionTimeout) {
    parts.push(`Connection Timeout=${config.connectionTimeout}`);
  }

  // Application name
  if (config.applicationName) {
    parts.push(`Application Name=${config.applicationName}`);
  }

  // Pool size from poolOptions
  if (config.poolOptions?.max) {
    parts.push(`Max Pool Size=${config.poolOptions.max}`);
  }
  if (config.poolOptions?.min) {
    parts.push(`Min Pool Size=${config.poolOptions.min}`);
  }

  return parts.join(';') + ';';
}
