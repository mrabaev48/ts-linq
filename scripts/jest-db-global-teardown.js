'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

const COMPOSE_FILE = path.resolve(__dirname, '../docker-compose.test.yml');

module.exports = async function globalTeardown() {
  if (!global.__TS_LINQ_DOCKER_STARTED__) return;
  console.log('\n🐳  Stopping Docker Compose test services...');
  spawnSync('docker', ['compose', '-f', COMPOSE_FILE, 'down'], { stdio: 'inherit' });
};
