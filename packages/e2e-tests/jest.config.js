const { createPackageJestConfig } = require('@ts-linq/jest-config');

module.exports = createPackageJestConfig({
  testMatch: ['**/*.e2e.test.ts'],
  testTimeout: 30000,
  detectOpenHandles: true,
  forceExit: true
});
