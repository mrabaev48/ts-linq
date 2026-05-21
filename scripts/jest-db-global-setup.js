'use strict';
/**
 * Shared Jest globalSetup for integration and e2e test packages.
 *
 * Starts docker-compose.test.yml services if not already running,
 * waits for them to become healthy, then injects DB connection env vars
 * into process.env so that test workers inherit them.
 *
 * If Docker is unavailable the setup exits silently; tests that require
 * a real DB will fail fast rather than hang because SKIP_DB_TESTS stays
 * unset (undefined → tests run but get a connection error immediately).
 */

const { spawnSync } = require('child_process');
const path = require('path');

const COMPOSE_FILE = path.resolve(__dirname, '../docker-compose.test.yml');

const DB_ENV = {
  POSTGRES_URL: 'postgresql://test:test@localhost:5432/testdb',
  POSTGRES_HOST: 'localhost',
  POSTGRES_PORT: '5432',
  POSTGRES_DB: 'testdb',
  POSTGRES_USER: 'test',
  POSTGRES_PASSWORD: 'test',
  MYSQL_URL: 'mysql://test:test@localhost:3306/testdb',
  MYSQL_HOST: 'localhost',
  MYSQL_PORT: '3306',
  MYSQL_DB: 'testdb',
  MYSQL_USER: 'test',
  MYSQL_PASSWORD: 'test',
  MYSQL_SPATIAL: '1',
  MYSQL_JSON: '1',
  MSSQL_URL: 'mssql://localhost',
  MSSQL_SERVER: 'localhost',
  MSSQL_PORT: '1433',
  MSSQL_USER: 'sa',
  MSSQL_PASSWORD: 'YourStrong@Passw0rd',
  MSSQL_DB: 'master',
  RUN_DB_TESTS: '1',
  SKIP_DB_TESTS: '0',
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { encoding: 'utf8', ...opts });
}

function isDockerAvailable() {
  return run('docker', ['info'], { stdio: 'ignore' }).status === 0;
}

function runningContainerCount() {
  const r = run('docker', ['compose', '-f', COMPOSE_FILE, 'ps', '--quiet']);
  if (r.status !== 0) return 0;
  return r.stdout.trim().split('\n').filter(Boolean).length;
}

async function waitForHealthy(timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  // MSSQL healthcheck path differs across image versions — only require it to be "running"
  const mustBeHealthy = ['postgres', 'mysql', 'redis', 'memcached'];

  while (Date.now() < deadline) {
    const r = run('docker', ['compose', '-f', COMPOSE_FILE, 'ps', '--format', 'json']);
    if (r.status !== 0) { await sleep(2000); continue; }

    // Compose v2 outputs one JSON object per line; v1 may output a JSON array
    const raw = r.stdout.trim();
    let containers;
    try {
      const parsed = JSON.parse(raw);
      containers = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      containers = raw.split('\n')
        .filter(Boolean)
        .map((l) => { try { return JSON.parse(l); } catch { return null; } })
        .filter(Boolean);
    }

    const allOk = mustBeHealthy.every((svc) => {
      const c = containers.find((x) => x.Service === svc || (x.Name || '').includes(svc));
      if (!c) return false;
      const health = c.Health || '';
      const state = (c.State || '').toLowerCase();
      if (state !== 'running') return false;
      // Health is '' when no healthcheck is defined, 'healthy' when it passed
      if (health === 'unhealthy' || health === 'starting') return false;
      return true;
    });

    if (allOk) return true;
    await sleep(2000);
  }
  return false;
}

module.exports = async function globalSetup() {
  // CI job already wired up DB services via GitHub Actions `services:` block
  // (e2e.yml sets POSTGRES_URL / MYSQL_URL / MSSQL_URL in the step env).
  // In that case just enable DB tests and exit — no Docker needed.
  if (process.env.POSTGRES_URL) {
    Object.assign(process.env, {
      ...DB_ENV,
      // Keep URLs provided by the CI environment
      POSTGRES_URL: process.env.POSTGRES_URL,
      MYSQL_URL: process.env.MYSQL_URL || DB_ENV.MYSQL_URL,
      MSSQL_URL: process.env.MSSQL_URL || DB_ENV.MSSQL_URL,
    });
    return;
  }

  // CI environment without DB services (ci.yml general quality job):
  // keep the original skip behaviour — do not attempt to start Docker.
  if (process.env.CI) {
    return;
  }

  // Local development: start Docker Compose automatically.
  if (!isDockerAvailable()) {
    console.warn('\n⚠  Docker not available — DB tests will run against a missing DB and fail.\n');
    return;
  }

  let started = false;

  if (runningContainerCount() < 5) {
    console.log('\n🐳  Starting Docker Compose test services...');

    // Prefer --wait (compose ≥ 2.2) for atomic start + health check
    let r = run('docker', ['compose', '-f', COMPOSE_FILE, 'up', '-d', '--wait', '--timeout', '120'], { stdio: 'inherit' });
    if (r.status !== 0) {
      // Older compose version — start in background, poll manually
      r = run('docker', ['compose', '-f', COMPOSE_FILE, 'up', '-d'], { stdio: 'inherit' });
    }
    if (r.status !== 0) {
      console.error('Failed to start Docker Compose services.');
      return;
    }
    started = true;
  }

  console.log('⏳  Waiting for services to become healthy...');
  const ready = await waitForHealthy();
  console.log(ready ? '✅  All services healthy.\n' : '⚠  Some services not yet healthy — tests will run anyway.\n');

  Object.assign(process.env, DB_ENV);
  global.__TS_LINQ_DOCKER_STARTED__ = started;
};
