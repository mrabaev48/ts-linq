import type { MySqlConfig } from '@ts-linq/types';

/**
 * Builds MySQL connection string from configuration object.
 * 
 * @param config - MySQL configuration
 * @returns Connection string in mysql:// URI format
 * 
 * @example
 * buildMysqlConnectionString({
 *   host: 'localhost',
 *   port: 3306,
 *   database: 'mydb',
 *   user: 'root',
 *   password: 'secret'
 * }) // => 'mysql://root:secret@localhost:3306/mydb'
 */
export function buildMysqlConnectionString(config: MySqlConfig): string {
  const { host, port = 3306, database, user, password } = config;
  
  // Build base URI
  let uri = 'mysql://';
  
  // Add credentials
  if (user) {
    uri += encodeURIComponent(user);
    if (password) {
      uri += ':' + encodeURIComponent(password);
    }
    uri += '@';
  }
  
  // Add host and port (or socket path)
  if (config.socketPath) {
    // For Unix socket connections, encode the path as a query parameter
    uri += 'localhost';
  } else {
    uri += host;
    if (port !== 3306) {
      uri += `:${port}`;
    }
  }
  
  // Add database
  uri += `/${database}`;
  
  // Add query parameters
  const params = new URLSearchParams();
  
  if (config.socketPath) {
    params.append('socketPath', config.socketPath);
  }
  
  if (config.charset) {
    params.append('charset', config.charset);
  }
  
  if (config.timezone) {
    params.append('timezone', config.timezone);
  }
  
  const queryString = params.toString();
  if (queryString) {
    uri += '?' + queryString;
  }
  
  return uri;
}
