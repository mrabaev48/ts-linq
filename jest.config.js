const includeIntegration = !!process.env.RUN_DB_TESTS;

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  detectOpenHandles: true,
  forceExit: true,
  roots: ['<rootDir>/packages', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  collectCoverageFrom: [
    'packages/**/src/**/*.ts', 
    '!packages/**/src/**/*.d.ts', 
    '!packages/**/src/index.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testTimeout: 10000,
  projects: [
    {
      displayName: 'core',
      testMatch: ['<rootDir>/packages/core/**/*.test.ts'],
      transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.stage3.json' }] },
    },
    ...(includeIntegration ? [{
      displayName: 'integration',
      testMatch: ['<rootDir>/tests/db/**/*.test.ts'],
      transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.tests.json' }] },
    }] : []),
    {
      displayName: 'sqlite',
      testMatch: ['<rootDir>/packages/sqlite/**/*.test.ts'],
      transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }] },
    },
    {
      displayName: 'postgres',
      testMatch: ['<rootDir>/packages/postgres/**/*.test.ts'],
      transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }] },
    },
    {
      displayName: 'mysql',
      testMatch: ['<rootDir>/packages/mysql/**/*.test.ts'],
      transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }] },
    },
    {
      displayName: 'mssql',
      testMatch: ['<rootDir>/packages/mssql/**/*.test.ts'],
      transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }] },
    }
  ]
};