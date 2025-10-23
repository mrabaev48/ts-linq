const { pathsToModuleNameMapper } = require('ts-jest');
const { compilerOptions } = require('./tsconfig.tests.json');

const includeIntegration = !!process.env.RUN_DB_TESTS;

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  detectOpenHandles: true,
  forceExit: true,
  roots: ['<rootDir>/packages'],
  modulePaths: [compilerOptions.baseUrl || '<rootDir>'],
  moduleDirectories: ['node_modules', 'packages'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        baseUrl: '.',
        paths: compilerOptions.paths,
        lib: ['ES2020', 'ES2021', 'ES2021.WeakRef']
      }
    }]
  },
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths || {}, { prefix: '<rootDir>/' }),
  testPathIgnorePatterns: includeIntegration ? [] : ['integration\\.test\\.ts$'],
  collectCoverageFrom: [
    'packages/*/src/**/*.ts',
    '!packages/*/src/**/*.d.ts',
    '!packages/*/src/**/*.test.ts',
    '!packages/*/src/**/*.spec.ts'
  ],
  setupFilesAfterEnv: ['<rootDir>/packages/core/tests/setup.ts'],
  testTimeout: 10000
};
