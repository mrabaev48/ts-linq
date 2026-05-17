import { createNodeConfig } from '@ts-linq/eslint-config';

export default createNodeConfig({
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
});
