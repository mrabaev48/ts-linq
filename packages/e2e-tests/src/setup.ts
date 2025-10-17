import { DatabaseHarness } from '@ts-linq/testkits';

export async function setupTestDatabase(provider: 'sqlite' | 'postgres' | 'mysql' | 'mssql') {
  const harness = new DatabaseHarness();
  
  const connectionStrings = {
    sqlite: ':memory:',
    postgres: process.env.POSTGRES_URL || 'postgres://test:test@localhost:5432/testdb',
    mysql: process.env.MYSQL_URL || 'mysql://test:test@localhost:3306/testdb',
    mssql: process.env.MSSQL_URL || 'Server=localhost,1433;Database=testdb;User Id=sa;Password=YourStrong@Passw0rd;'
  };

  let dbProvider;
  
  switch (provider) {
    case 'sqlite': {
      const { SQLiteProvider } = await import('@ts-linq/provider-sqlite');
      dbProvider = new SQLiteProvider({ database: ':memory:' });
      break;
    }
    case 'postgres': {
      const { PostgresProvider } = await import('@ts-linq/provider-postgres');
      dbProvider = new PostgresProvider({ connectionString: connectionStrings.postgres });
      break;
    }
    case 'mysql': {
      const { MySqlProvider } = await import('@ts-linq/provider-mysql');
      dbProvider = new MySqlProvider({
        host: 'localhost',
        user: 'test',
        password: 'test',
        database: 'testdb'
      });
      break;
    }
    case 'mssql': {
      const { MssqlProvider } = await import('@ts-linq/provider-mssql');
      dbProvider = new MssqlProvider({
        server: 'localhost',
        database: 'testdb',
        user: 'sa',
        password: 'YourStrong@Passw0rd'
      });
      break;
    }
  }

  await harness.setup({ provider: dbProvider, autoConnect: true });
  
  return { harness, provider: dbProvider };
}

export async function teardownTestDatabase(harness: DatabaseHarness) {
  await harness.teardown();
}
