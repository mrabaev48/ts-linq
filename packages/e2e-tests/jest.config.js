const path = require('path');
const { createPackageJestConfig } = require('@ts-linq/jest-config');

const repoRoot = path.resolve(__dirname, '../..');

module.exports = createPackageJestConfig({
  testMatch: ['**/*.e2e.test.ts'],
  testTimeout: 30000,
  detectOpenHandles: true,
  forceExit: true,
  globalSetup: path.join(repoRoot, 'scripts/jest-db-global-setup.js'),
  globalTeardown: path.join(repoRoot, 'scripts/jest-db-global-teardown.js'),
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.json',
        astTransformers: {
          before: [{ path: '<rootDir>/src/jest-transformer.js' }]
        }
      }
    ]
  }
});
