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
      transform: { '^.+\\.ts$': 'ts-jest' },
    },
    {
      displayName: 'sqlite',
      testMatch: ['<rootDir>/packages/sqlite/**/*.test.ts'],
      transform: { '^.+\\.ts$': 'ts-jest' },
    },
    {
      displayName: 'postgres',
      testMatch: ['<rootDir>/packages/postgres/**/*.test.ts'],
      transform: { '^.+\\.ts$': 'ts-jest' },
    },
    {
      displayName: 'mysql',
      testMatch: ['<rootDir>/packages/mysql/**/*.test.ts'],
      transform: { '^.+\\.ts$': 'ts-jest' },
    },
    {
      displayName: 'mssql',
      testMatch: ['<rootDir>/packages/mssql/**/*.test.ts'],
      transform: { '^.+\\.ts$': 'ts-jest' },
    }
  ]
};