/**** Basic Testcontainers setup for DB-backed tests ****/

import type { StartedTestContainer } from 'testcontainers';
import { GenericContainer, Wait } from 'testcontainers';

let postgres: StartedTestContainer | null = null;
let mysql: StartedTestContainer | null = null;
let mssql: StartedTestContainer | null = null;

export async function startDbContainers() {
  if (process.env.RUN_DB_TESTS !== '1') return;
  const db = process.env.DB; // 'postgres' | 'mysql' | 'mssql' | 'sqlite' | undefined
  const pgImage = process.env.POSTGRES_IMAGE || 'postgres:15-alpine';
  const mysqlImage = process.env.MYSQL_IMAGE || 'mysql:8';
  const mssqlImage = process.env.MSSQL_IMAGE || 'mcr.microsoft.com/mssql/server:2019-latest';

  if (!db || db === 'postgres') {
    const c = await new GenericContainer(pgImage)
      .withEnvironment({ POSTGRES_PASSWORD: 'test', POSTGRES_DB: 'testdb' })
      .withExposedPorts(5432)
      .start();
    postgres = c;
    process.env.POSTGRES_URL = `postgres://postgres:test@${c.getHost()}:${c.getMappedPort(5432)}/testdb`;
  }

  if (!db || db === 'mysql') {
    const c = await new GenericContainer(mysqlImage)
      .withEnvironment({ MYSQL_ROOT_PASSWORD: 'test', MYSQL_DATABASE: 'testdb' })
      .withExposedPorts(3306)
      .withWaitStrategy(Wait.forLogMessage(/ready for connections/i))
      .start();
    mysql = c;
    process.env.MYSQL_URL = `mysql://root:test@${c.getHost()}:${c.getMappedPort(3306)}/testdb`;
  }

  if (!db || db === 'mssql') {
    const saPassword = process.env.MSSQL_SA_PASSWORD || 'YourStrong!Passw0rd';
    const c = await new GenericContainer(mssqlImage)
      .withEnvironment({ ACCEPT_EULA: 'Y', SA_PASSWORD: saPassword })
      .withExposedPorts(1433)
      .start();
    mssql = c;
    process.env.MSSQL_URL = `mssql://sa:${encodeURIComponent(saPassword)}@${c.getHost()}:${c.getMappedPort(1433)}/tempdb`;
  }
}

export async function stopDbContainers() {
  await Promise.all([
    postgres?.stop().catch(() => {}),
    mysql?.stop().catch(() => {}),
    mssql?.stop().catch(() => {})
  ]);
  postgres = null;
  mysql = null;
  mssql = null;
}
