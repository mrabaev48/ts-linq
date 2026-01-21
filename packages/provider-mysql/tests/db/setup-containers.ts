/** Basic Testcontainers setup for DB-backed tests */

import type { StartedTestContainer } from 'testcontainers';
import { GenericContainer, Wait } from 'testcontainers';

let postgres: StartedTestContainer | null = null;
let mysql: StartedTestContainer | null = null;
let mssql: StartedTestContainer | null = null;

export async function startDbContainers(): Promise<void> {
  if (process.env.RUN_DB_TESTS !== '1') return;
  const db = process.env.DB; // 'postgres' | 'mysql' | 'mssql' | undefined
  const pgImage = process.env.POSTGRES_IMAGE || 'postgres:15-alpine';
  const mysqlImage = process.env.MYSQL_IMAGE || 'mysql:8';
  const mssqlImage = process.env.MSSQL_IMAGE || 'mcr.microsoft.com/mssql/server:2019-latest';

  if (!db || db === 'postgres') {
    postgres = await new GenericContainer(pgImage)
      .withEnv('POSTGRES_PASSWORD', 'test')
      .withEnv('POSTGRES_DB', 'testdb')
      .withExposedPorts(5432)
      .start();
    process.env.POSTGRES_URL = `postgres://postgres:test@${postgres.getHost()}:${postgres.getMappedPort(5432)}/testdb`;
  }

  if (!db || db === 'mysql') {
    mysql = await new GenericContainer(mysqlImage)
      .withEnv('MYSQL_ROOT_PASSWORD', 'test')
      .withEnv('MYSQL_DATABASE', 'testdb')
      .withExposedPorts(3306)
      .withWaitStrategy(Wait.forLogMessage(/ready for connections/i))
      .withStartupTimeout(180_000)
      .start();
    process.env.MYSQL_URL = `mysql://root:test@${mysql.getHost()}:${mysql.getMappedPort(3306)}/testdb`;
  }

  if (!db || db === 'mssql') {
    const saPassword = process.env.MSSQL_SA_PASSWORD || 'YourStrong!Passw0rd';
    mssql = await new GenericContainer(mssqlImage)
      .withEnv('ACCEPT_EULA', 'Y')
      .withEnv('SA_PASSWORD', saPassword)
      .withExposedPorts(1433)
      .start();
    process.env.MSSQL_URL = `mssql://sa:${encodeURIComponent(saPassword)}@${mssql.getHost()}:${mssql.getMappedPort(1433)}/tempdb`;
  }
}

export async function stopDbContainers(): Promise<void> {
  await Promise.all([
    postgres?.stop().catch(() => {}),
    mysql?.stop().catch(() => {}),
    mssql?.stop().catch(() => {})
  ]);
  postgres = null;
  mysql = null;
  mssql = null;
}

