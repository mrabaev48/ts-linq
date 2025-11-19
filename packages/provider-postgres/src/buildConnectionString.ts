import type { PostgresConfig } from '@ts-linq/types';

/**
 * Builds PostgreSQL connection string from configuration object.
 * 
 * @param config - PostgreSQL configuration
 * @returns Connection string in postgresql:// URI format
 * 
 * @example
 * buildPostgresConnectionString({
 *   host: 'localhost',
 *   port: 5432,
 *   database: 'mydb',
 *   user: 'admin',
 *   password: 'secret'
 * }) // => 'postgresql://admin:secret@localhost:5432/mydb'
 */
export function buildPostgresConnectionString(config: PostgresConfig): string {
  const { host, port = 5432, database, user, password } = config;
  
  // Build base URI
  let uri = 'postgresql://';
  
  // Add credentials
  if (user) {
    uri += encodeURIComponent(user);
    if (password) {
      uri += ':' + encodeURIComponent(password);
    }
    uri += '@';
  }
  
  // Add host and port
  // Handle IPv6 addresses
  if (host.includes(':')) {
    uri += `[${host}]`;
  } else {
    uri += host;
  }
  
  if (port !== 5432) {
    uri += `:${port}`;
  }
  
  // Add database
  uri += `/${database}`;
  
  // Add query parameters
  const params = new URLSearchParams();
  
  if (config.ssl === true) {
    params.append('sslmode', 'require');
  } else if (config.ssl === false) {
    params.append('sslmode', 'disable');
  }
  
  if (config.applicationName) {
    params.append('application_name', config.applicationName);
  }
  
  if (config.schema) {
    params.append('schema', config.schema);
  }
  
  if (config.connectionTimeoutMs) {
    params.append('connect_timeout', Math.floor(config.connectionTimeoutMs / 1000).toString());
  }
  
  const queryString = params.toString();
  if (queryString) {
    uri += '?' + queryString;
  }
  
  return uri;
}
