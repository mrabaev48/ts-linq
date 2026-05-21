const { createJestConfig } = require('@ts-linq/jest-config');

const base = createJestConfig({
  roots: ['<rootDir>/packages'],
  testMatch: ['**/*.test.ts', '**/*.spec.ts'],
  setupFiles: ['<rootDir>/jest.setup.js']
});

module.exports = {
  ...base,
  rootDir: '../../',
  roots: ['<rootDir>/packages/integration-tests/tests-new'],
  testTimeout: Math.max(base.testTimeout ?? 10000, 30000),
  testPathIgnorePatterns: ['/node_modules/', '/tests-old/'],
  testSequencer: '<rootDir>/packages/integration-tests/jest.sequencer.js',
  globalSetup: '<rootDir>/scripts/jest-db-global-setup.js',
  globalTeardown: '<rootDir>/scripts/jest-db-global-teardown.js',
};
