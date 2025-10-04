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
    '^@ts-linq/sqlite$': '<rootDir>/packages/sqlite/src',
    '^@ts-linq/postgres$': '<rootDir>/packages/postgres/src',
    '^@ts-linq/mysql$': '<rootDir>/packages/mysql/src',
    '^@ts-linq/mssql$': '<rootDir>/packages/mssql/src',
    '^@ts-linq/core$': '<rootDir>/packages/core/src',
    '^@ts-linq/core/(.*)$': '<rootDir>/packages/core/src/$1',
    '^@ts-linq/sqlite/(.*)$': '<rootDir>/packages/sqlite/src/$1',
    '^@ts-linq/postgres/(.*)$': '<rootDir>/packages/postgres/src/$1',
    '^@ts-linq/mysql/(.*)$': '<rootDir>/packages/mysql/src/$1',
    '^@ts-linq/dialect-mysql$': '<rootDir>/packages/dialect-mysql/src',
    '^@ts-linq/dialect-mysql/(.*)$': '<rootDir>/packages/dialect-mysql/src/$1',
    '^@ts-linq/sql-visitor$': '<rootDir>/packages/sql-visitor/src',
    '^@ts-linq/sql-visitor/(.*)$': '<rootDir>/packages/sql-visitor/src/$1',
    '^@ts-linq/dialect-postgres$': '<rootDir>/packages/dialect-postgres/src',
    '^@ts-linq/dialect-postgres/(.*)$': '<rootDir>/packages/dialect-postgres/src/$1',
    '^@ts-linq/provider-pg$': '<rootDir>/packages/provider-pg/src',
    '^@ts-linq/provider-pg/(.*)$': '<rootDir>/packages/provider-pg/src/$1',
    '^@ts-linq/provider-mysql$': '<rootDir>/packages/provider-mysql/src',
    '^@ts-linq/provider-mysql/(.*)$': '<rootDir>/packages/provider-mysql/src/$1',
    '^@ts-linq/mssql/(.*)$': '<rootDir>/packages/mssql/src/$1',
    '^(\\.\\.\/)+src\/(.*)$': '<rootDir>/packages/core/src/$2',
    '^(\\.\\.\/)+context\/(.*)$': '<rootDir>/packages/core/src/context/$2',
    '^(\\.\\.\/)+metadata\/(.*)$': '<rootDir>/packages/core/src/metadata/$2',
    '^(\\.\\.\/)+types$': '<rootDir>/packages/core/src/types',
    '^(\\.\\.\/)+types\/(.*)$': '<rootDir>/packages/core/src/types/$2',
    '^(\\.\\.\/)+DatabaseProvider$': '<rootDir>/packages/core/src/DatabaseProvider',
    '^(\\.\\.\/)+query\/(.*)$': '<rootDir>/packages/core/src/query/$2',
    '^(\\.\\.\/)+decorators\/(.*)$': '<rootDir>/packages/core/src/decorators/$2',
    '^(\\.\\.\/)+migrations\/(.*)$': '<rootDir>/packages/core/src/migrations/$2',
    '^(\\.\\.\/)+utils\/(.*)$': '<rootDir>/packages/core/src/utils/$2',

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
            testMatch: [
              '<rootDir>/packages/sqlite/tests/**/*integration*.test.ts',
              '<rootDir>/packages/postgres/tests/**/*integration*.test.ts',
              '<rootDir>/packages/mysql/tests/**/*integration*.test.ts',
              '<rootDir>/packages/mssql/tests/**/*integration*.test.ts'
            ],
            transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.stage3.json' }] }
          }
        ]
      : []),
    {
      displayName: 'sqlite',
      testMatch: ['<rootDir>/packages/sqlite/{src,tests}/**/*.test.ts'],
      transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.stage3.json' }] }
    },
    {
      displayName: 'postgres',
      testMatch: ['<rootDir>/packages/postgres/{src,tests}/**/*.test.ts'],
      transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.stage3.json' }] }
    },
    {
      displayName: 'dialect-postgres',
      testMatch: ['<rootDir>/packages/dialect-postgres/{src,tests}/**/*.test.ts'],
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
      displayName: 'mysql',
      testMatch: ['<rootDir>/packages/mysql/{src,tests}/**/*.test.ts'],
      transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.stage3.json' }] }
    },
    {
      displayName: 'dialect-mysql',
      testMatch: ['<rootDir>/packages/dialect-mysql/{src,tests}/**/*.test.ts'],
      transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.stage3.json' }] }
    },
    {
      displayName: 'mssql',
      testMatch: ['<rootDir>/packages/mssql/{src,tests}/**/*.test.ts'],
      transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.stage3.json' }] }
    },
    {
      displayName: 'cli',
      testMatch: ['<rootDir>/packages/cli/{src,tests}/**/*.test.ts'],
      transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.stage3.json' }] }
    }
  ]
};
