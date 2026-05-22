import { DatabaseHarness } from '@ts-linq/testkits';

function parsePostgresUrl(url: string) {
  try {
    const u = new URL(url);
    return {
      host: u.hostname,
      port: u.port ? parseInt(u.port) : 5432,
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      database: u.pathname.replace(/^\//, '')
    };
  } catch {
    return { host: 'localhost', port: 5432, user: 'test', password: 'test', database: 'testdb' };
  }
}

function parseMysqlUrl(url: string) {
  try {
    const u = new URL(url);
    return {
      host: u.hostname,
      port: u.port ? parseInt(u.port) : 3306,
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      database: u.pathname.replace(/^\//, '')
    };
  } catch {
    return { host: 'localhost', port: 3306, user: 'test', password: 'test', database: 'testdb' };
  }
}

function parseMssqlUrl(url: string) {
  try {
    const u = new URL(url);
    const user = decodeURIComponent(u.username) || process.env.MSSQL_USER || 'sa';
    const password =
      decodeURIComponent(u.password) || process.env.MSSQL_PASSWORD || 'YourStrong@Passw0rd';
    const database = u.pathname.replace(/^\//, '') || process.env.MSSQL_DB || 'master';
    return {
      server: u.hostname || process.env.MSSQL_SERVER || 'localhost',
      port: u.port ? parseInt(u.port) : parseInt(process.env.MSSQL_PORT ?? '1433'),
      user,
      password,
      database
    };
  } catch {
    return {
      server: process.env.MSSQL_SERVER || 'localhost',
      port: parseInt(process.env.MSSQL_PORT ?? '1433'),
      user: process.env.MSSQL_USER || 'sa',
      password: process.env.MSSQL_PASSWORD || 'YourStrong@Passw0rd',
      database: process.env.MSSQL_DB || 'master'
    };
  }
}

export async function setupTestDatabase(provider: 'postgresql' | 'mysql' | 'mssql') {
  const harness = new DatabaseHarness();

  const connectionStrings = {
    postgresql: process.env.POSTGRES_URL || 'postgres://test:test@localhost:5432/testdb',
    mysql: process.env.MYSQL_URL || 'mysql://test:test@localhost:3306/testdb',
    mssql: process.env.MSSQL_URL || 'mssql://sa:YourStrong%40Passw0rd@localhost:1433/testdb'
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let dbProvider: any;

  switch (provider) {
    case 'postgresql': {
      const { PostgresProvider } = await import('@ts-linq/provider-postgres');
      dbProvider = new PostgresProvider(parsePostgresUrl(connectionStrings.postgresql));
      break;
    }
    case 'mysql': {
      const { MySqlProvider } = await import('@ts-linq/provider-mysql');
      const cfg = parseMysqlUrl(connectionStrings.mysql);
      dbProvider = new MySqlProvider({
        host: cfg.host,
        user: cfg.user,
        password: cfg.password,
        database: cfg.database
      });
      break;
    }
    case 'mssql': {
      const { MssqlProvider } = await import('@ts-linq/provider-mssql');
      const cfg = parseMssqlUrl(connectionStrings.mssql);
      dbProvider = new MssqlProvider({
        server: cfg.server,
        port: cfg.port,
        user: cfg.user,
        password: cfg.password,
        database: cfg.database,
        trustServerCertificate: true
      });
      break;
    }
  }

  // autoConnect: false — context.ensureCreated() handles the single connect() call
  await harness.setup({ provider: dbProvider, autoConnect: false });

  return { harness, provider: dbProvider };
}

export async function teardownTestDatabase(harness: DatabaseHarness) {
  await harness.teardown();
}

/**
 * Drop tables in reverse dependency order to avoid FK constraint violations.
 * Pass tables in definition order (parent first); they are dropped child-first.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function dropTables(provider: any, tableNames: string[]): Promise<void> {
  for (const table of [...tableNames].reverse()) {
    await provider.executeNonQuery(`DROP TABLE IF EXISTS ${table}`, []);
  }
}
