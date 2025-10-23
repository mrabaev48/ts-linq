import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/**/tests/**/*.test.ts', 'packages/**/tests/**/*.spec.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.turbo/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/tests/**',
        '**/*.test.ts',
        '**/*.spec.ts',
      ],
    },
    testTimeout: 10000,
    hookTimeout: 10000,
  },
  plugins: [
    swc.vite({
      jsc: {
        parser: {
          syntax: 'typescript',
          decorators: true,
          dynamicImport: true,
        },
        transform: {
          decoratorVersion: '2022-03',
        },
        target: 'es2022',
        keepClassNames: true,
      },
      module: {
        type: 'es6',
      },
    }),
  ],
  resolve: {
    alias: {
      '@ts-linq/types': path.resolve(__dirname, 'packages/types/src'),
      '@ts-linq/metadata': path.resolve(__dirname, 'packages/metadata/src'),
      '@ts-linq/core': path.resolve(__dirname, 'packages/core/src'),
      '@ts-linq/orm': path.resolve(__dirname, 'packages/orm/src'),
      '@ts-linq/query': path.resolve(__dirname, 'packages/query/src'),
      '@ts-linq/cache': path.resolve(__dirname, 'packages/cache/src'),
      '@ts-linq/ast': path.resolve(__dirname, 'packages/ast/src'),
      '@ts-linq/metrics-safe': path.resolve(__dirname, 'packages/metrics-safe/src'),
      '@ts-linq/provider-sqlite': path.resolve(__dirname, 'packages/provider-sqlite/src'),
      '@ts-linq/provider-postgres': path.resolve(__dirname, 'packages/provider-postgres/src'),
      '@ts-linq/provider-mysql': path.resolve(__dirname, 'packages/provider-mysql/src'),
      '@ts-linq/provider-mssql': path.resolve(__dirname, 'packages/provider-mssql/src'),
      '@ts-linq/dialect-sqlite': path.resolve(__dirname, 'packages/dialect-sqlite/src'),
      '@ts-linq/dialect-postgres': path.resolve(__dirname, 'packages/dialect-postgres/src'),
      '@ts-linq/dialect-mysql': path.resolve(__dirname, 'packages/dialect-mysql/src'),
      '@ts-linq/dialect-mssql': path.resolve(__dirname, 'packages/dialect-mssql/src'),
      '@ts-linq/testkits': path.resolve(__dirname, 'packages/testkits/src'),
      '@ts-linq/composite-sql-logger': path.resolve(__dirname, 'packages/composite-sql-logger/src'),
      '@ts-linq/prometheus-sql-logger': path.resolve(__dirname, 'packages/prometheus-sql-logger/src'),
      '@ts-linq/open-telemetry-sql-logger': path.resolve(__dirname, 'packages/open-telemetry-sql-logger/src'),
    },
  },
});
