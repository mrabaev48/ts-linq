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
    '^\\.\\.\\/src\\/providers\\/SQLiteProvider$': '<rootDir>/packages/sqlite/src/SQLiteProvider',
    '^\\.\\.\\/src\\/providers\\/PostgresProvider$': '<rootDir>/packages/postgres/src/PostgresProvider',
    '^\\.\\.\\/src\\/providers\\/MySqlProvider$': '<rootDir>/packages/mysql/src/MySqlProvider',
    '^\\.\\.\\/src\\/providers\\/MssqlProvider$': '<rootDir>/packages/mssql/src/MssqlProvider',
    '^\\.\\.\\/src\\/providers\\/DatabaseProvider$': '<rootDir>/packages/core/src/DatabaseProvider',
    '^\\.\\.\\/src\\/providers\\/DdlBuilder$': '<rootDir>/packages/core/src/DdlBuilder',
    '^\\.\\.\\/src\\/providers\\/sqlite\\/SQLiteDdlStrategy$': '<rootDir>/packages/sqlite/src/SQLiteDdlStrategy',
    '^\\.\\.\\/src\\/providers\\/mysql\\/MySqlDdlStrategy$': '<rootDir>/packages/mysql/src/MySqlDdlStrategy',
    '^\\.\\.\\/src\\/providers\\/mssql\\/MssqlDdlStrategy$': '<rootDir>/packages/mssql/src/MssqlDdlStrategy',
    '^\\.\\.\\/src\\/providers\\/postgres\\/PostgresDdlStrategy$': '<rootDir>/packages/postgres/src/PostgresDdlStrategy',
    '^\\.\\.\\/src\\/query\\/SQLiteDialect$': '<rootDir>/packages/sqlite/src/SQLiteDialect',
    '^\\.\\.\\/src\\/query\\/MysqlDialect$': '<rootDir>/packages/mysql/src/MysqlDialect',
    '^\\.\\.\\/src\\/query\\/PostgresDialect$': '<rootDir>/packages/postgres/src/PostgresDialect',
    '^\\.\\.\\/src\\/query\\/MssqlDialect$': '<rootDir>/packages/mssql/src/MssqlDialect',
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
      displayName: 'core',
      testMatch: ['<rootDir>/packages/core/{src,tests}/**/*.test.ts'],
      transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }] }
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
