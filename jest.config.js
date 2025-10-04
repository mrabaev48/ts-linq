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
  moduleNameMapper: {
    '^@ts-linq/ast$': '<rootDir>/packages/ast/src',
    '^@ts-linq/ast/(.*)$': '<rootDir>/packages/ast/src/$1',
    '^@core/(.*)$': '<rootDir>/packages/core/src/$1',
    '^@src/(.*)$': '<rootDir>/$1',
    // dialects and visitors
    '^@ts-linq/dialect-mssql$': '<rootDir>/packages/dialect-mssql/src',
    '^@ts-linq/dialect-mssql/(.*)$': '<rootDir>/packages/dialect-mssql/src/$1',
    '^@ts-linq/dialect-mysql$': '<rootDir>/packages/dialect-mysql/src',
    '^@ts-linq/dialect-mysql/(.*)$': '<rootDir>/packages/dialect-mysql/src/$1',
    '^@ts-linq/dialect-postgres$': '<rootDir>/packages/dialect-postgres/src',
    '^@ts-linq/dialect-postgres/(.*)$': '<rootDir>/packages/dialect-postgres/src/$1',
    '^@ts-linq/dialect-sqlite$': '<rootDir>/packages/dialect-sqlite/src',
    '^@ts-linq/dialect-sqlite/(.*)$': '<rootDir>/packages/dialect-sqlite/src/$1',
    '^@ts-linq/sql-visitor$': '<rootDir>/packages/sql-visitor/src',
    '^@ts-linq/sql-visitor/(.*)$': '<rootDir>/packages/sql-visitor/src/$1',
    // core
    '^@ts-linq/core$': '<rootDir>/packages/core/src',
    '^@ts-linq/core/(.*)$': '<rootDir>/packages/core/src/$1',
    // providers
    '^@ts-linq/provider-pg$': '<rootDir>/packages/provider-pg/src',
    '^@ts-linq/provider-pg/(.*)$': '<rootDir>/packages/provider-pg/src/$1',
    '^@ts-linq/provider-mysql$': '<rootDir>/packages/provider-mysql/src',
    '^@ts-linq/provider-mysql/(.*)$': '<rootDir>/packages/provider-mysql/src/$1',
    '^@ts-linq/provider-mssql$': '<rootDir>/packages/provider-mssql/src',
    '^@ts-linq/provider-mssql/(.*)$': '<rootDir>/packages/provider-mssql/src/$1',
    '^@ts-linq/provider-sqlite$': '<rootDir>/packages/provider-sqlite/src',
    '^@ts-linq/provider-sqlite/(.*)$': '<rootDir>/packages/provider-sqlite/src/$1',
    // core relative fallbacks used across packages
    '^(\\.\\.\/)+src\\/(.*)$': '<rootDir>/packages/core/src/$2',
    '^(\\.\\.\/)+context\\/(.*)$': '<rootDir>/packages/core/src/context/$2',
    '^(\\.\\.\/)+metadata\\/(.*)$': '<rootDir>/packages/core/src/metadata/$2',
    '^(\\.\\.\/)+types$': '<rootDir>/packages/core/src/types',
    '^(\\.\\.\/)+types\\/(.*)$': '<rootDir>/packages/core/src/types/$2',
    '^(\\.\\.\/)+DatabaseProvider$': '<rootDir>/packages/core/src/DatabaseProvider',
    '^(\\.\\.\/)+query\\/(.*)$': '<rootDir>/packages/core/src/query/$2',
    '^(\\.\\.\/)+decorators\\/(.*)$': '<rootDir>/packages/core/src/decorators/$2',
    '^(\\.\\.\/)+migrations\\/(.*)$': '<rootDir>/packages/core/src/migrations/$2',
    '^(\\.\\.\/)+utils\\/(.*)$': '<rootDir>/packages/core/src/utils/$2',
    // other
    '^\\.\\.\\/src\\/utils\\/PrometheusSqlLogger$': '<rootDir>/packages/prometheus-sql-logger/src/logger/PrometheusSqlLogger'
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
      displayName: 'ast',
      testMatch: ['<rootDir>/packages/ast/{src,tests}/**/*.test.ts'],
      transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.stage3.json', diagnostics: false, isolatedModules: true }] }
    },
    {
      displayName: 'sql-visitor',
      testMatch: ['<rootDir>/packages/sql-visitor/{src,tests}/**/*.test.ts'],
      transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.stage3.json', diagnostics: false, isolatedModules: true }] }
    },
    {
      displayName: 'core',
      testMatch: ['<rootDir>/packages/core/{src,tests}/**/*.test.ts'],
      transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.stage3.json', diagnostics: false, isolatedModules: true }] }
    },
    ...(includeIntegration
      ? [
          {
            displayName: 'db',
            testMatch: ['<rootDir>/packages/integration-tests/tests/**/*.test.ts'],
            setupFilesAfterEnv: ['<rootDir>/packages/integration-tests/tests/db/setup-containers.ts'],
            transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.stage3.json' }] }
          }
        ]
      : []),
    {
      displayName: 'dialect-postgres',
      testMatch: ['<rootDir>/packages/dialect-postgres/{src,tests}/**/*.test.ts'],
      transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.stage3.json' }] }
    },
    {
      displayName: 'dialect-sqlite',
      testMatch: ['<rootDir>/packages/dialect-sqlite/{src,tests}/**/*.test.ts'],
      transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.stage3.json' }] }
    },
    {
      displayName: 'provider-pg',
      testMatch: ['<rootDir>/packages/provider-pg/{src,tests}/**/*.test.ts'],
      transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.stage3.json' }] }
    },
    {
      displayName: 'provider-mysql',
      testMatch: ['<rootDir>/packages/provider-mysql/{src,tests}/**/*.test.ts'],
      transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.stage3.json' }] }
    },
    {
      displayName: 'provider-mssql',
      testMatch: ['<rootDir>/packages/provider-mssql/{src,tests}/**/*.test.ts'],
      transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.stage3.json' }] }
    },
    {
      displayName: 'provider-sqlite',
      testMatch: ['<rootDir>/packages/provider-sqlite/{src,tests}/**/*.test.ts'],
      transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.stage3.json' }] }
    },
    {
      displayName: 'dialect-mysql',
      testMatch: ['<rootDir>/packages/dialect-mysql/{src,tests}/**/*.test.ts'],
      transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.stage3.json' }] }
    },
    {
      displayName: 'dialect-mssql',
      testMatch: ['<rootDir>/packages/dialect-mssql/{src,tests}/**/*.test.ts'],
      transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.stage3.json' }] }
    },
    {
      displayName: 'cli',
      testMatch: ['<rootDir>/packages/cli/{src,tests}/**/*.test.ts'],
      transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.stage3.json' }] }
    }
  ]
};
