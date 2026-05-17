const { createJestConfig } = require('@ts-linq/jest-config');

module.exports = createJestConfig({
  roots: ['<rootDir>/packages'],
  testMatch: ['**/*.test.ts', '**/*.spec.ts'],
  setupFiles: ['<rootDir>/jest.setup.js']
});
