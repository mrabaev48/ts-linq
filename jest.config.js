const includeIntegration = !!process.env.RUN_DB_TESTS;

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  detectOpenHandles: true,
  forceExit: true,
  roots: ['<rootDir>/packages'],
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
  setupFilesAfterEnv: ['<rootDir>/packages/core/tests/setup.ts'],
  testTimeout: 10000,
  projects: [
    {
      displayName: 'core',
      testMatch: ['<rootDir>/packages/core/{src,tests}/**/*.test.ts'],
      transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.stage3.json' }] }
    },
    ...(includeIntegration
      ? [
          {
            displayName: 'db',
            testMatch: ['<rootDir>/packages/**/tests/**/*integration*.test.ts'],
            transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.tests.json' }] }
          }
        ]
      : []),
    {
      displayName: 'sqlite',
      testMatch: ['<rootDir>/packages/sqlite/{src,tests}/**/*.test.ts'],
      transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }] }
    },
    {
      displayName: 'postgres',
      testMatch: ['<rootDir>/packages/postgres/{src,tests}/**/*.test.ts'],
      transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }] }
    },
    {
      displayName: 'mysql',
      testMatch: ['<rootDir>/packages/mysql/{src,tests}/**/*.test.ts'],
      transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }] }
    },
    {
      displayName: 'mssql',
      testMatch: ['<rootDir>/packages/mssql/{src,tests}/**/*.test.ts'],
      transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }] }
    }
  ]
};
