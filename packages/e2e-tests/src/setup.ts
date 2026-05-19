import { DatabaseHarness } from '@ts-linq/testkits';

function parsePostgresUrl(url: string) {
  try {
    const u = new URL(url);
    return {
      host: u.hostname,
      port: u.port ? parseInt(u.port) : 5432,
      user: u.username,
      password: u.password,
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
      user: u.username,
      password: u.password,
      database: u.pathname.replace(/^\//, '')
    };
  } catch {
    return { host: 'localhost', port: 3306, user: 'test', password: 'test', database: 'testdb' };
  }
}

function parseMssqlUrl(url: string) {
  try {
    const u = new URL(url);
    return {
      server: u.hostname,
      port: u.port ? parseInt(u.port) : 1433,
      user: u.username,
      password: u.password,
      database: u.pathname.replace(/^\//, '')
    };
  } catch {
    return {
      server: 'localhost',
      port: 1433,
      user: 'sa',
      password: 'YourStrong@Passw0rd',
      database: 'testdb'
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
        database: cfg.database
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
