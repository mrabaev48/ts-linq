/**** Basic Testcontainers setup for DB-backed tests ****/

import { GenericContainer, StartedTestContainer } from 'testcontainers';

let postgres: StartedTestContainer | null = null;
let mysql: StartedTestContainer | null = null;

export async function startDbContainers() {
  if (process.env.RUN_DB_TESTS !== '1') return;
  const db = process.env.DB; // 'postgres' | 'mysql' | undefined
  const pgImage = process.env.POSTGRES_IMAGE || 'postgres:15-alpine';
  const mysqlImage = process.env.MYSQL_IMAGE || 'mysql:8';

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
    .start();
    process.env.MYSQL_URL = `mysql://root:test@${mysql.getHost()}:${mysql.getMappedPort(3306)}/testdb`;
  }
}

export async function stopDbContainers() {
  await Promise.all([
    postgres?.stop().catch(() => {}),
    mysql?.stop().catch(() => {}),
  ]);
  postgres = null;
  mysql = null;
}
