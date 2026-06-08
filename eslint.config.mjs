import { createNodeConfig } from '@ts-linq/eslint-config';

export default [
  ...createNodeConfig({
    tsconfigRootDir: import.meta.dirname,
    // Single root tsconfig.eslint.json covers all packages' src + test files.
    // Using one project (not 35) is much faster than per-package tsconfig array.
    project: ['./tsconfig.eslint.json'],
    ignores: [
      'shop.db',
      'packages/integration-tests/jest.sequencer.js',
      'scripts/**',
      'rollup.config.mjs',
      'size-tests/**',
      'ts-linq.config.example.ts',
      '.claude/**',
      '.claire/**',
      'coverage/**',
      'commitlint.config.js',
      'jest.setup.js',
      'madge.config.cjs',
      '.dependency-cruiser.cjs',
      'packages/*/scripts/**',
      'packages/core/tests-old/**'
    ]
  }),
  // ─── @ts-linq/metadata: stricter type-safety on the mapping model (metadata/task-5) ───
  // The metadata model must not reintroduce the opaque `Function` type or redundant
  // type assertions now that the API is keyed on `EntityCtor`.
  {
    files: ['packages/metadata/src/**/*.ts'],
    rules: {
      // Successor to the deprecated `ban-types` rule for the bare `Function` type.
      '@typescript-eslint/no-unsafe-function-type': 'error',
      '@typescript-eslint/no-unnecessary-type-assertion': 'error'
    }
  }
];
