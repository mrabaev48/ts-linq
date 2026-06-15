import stylisticPlugin from '@stylistic/eslint-plugin';
import prettierConfig from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import unusedImports from 'eslint-plugin-unused-imports';
import globals from 'globals';
import typescriptEslint from 'typescript-eslint';

// ─── Ignore patterns shared by all consumers ───────────────────────────────

const defaultIgnores = [
  '**/dist/**',
  '**/node_modules/**',
  '**/*.d.ts',
  '**/test-d/**',
  '**/tests/**/*.d.ts',
  '**/docs/**',
  '**/examples/**',
  // Jest config files are plain JS — not type-checked
  '**/jest*.config.js',
  '**/jest*.config.cjs',
  '**/jest*.config.mjs'
];

// ─── Rule sets ────────────────────────────────────────────────────────────

const baseEslintRules = {
  'no-console': ['warn', { allow: ['warn', 'error', 'log'] }],
  complexity: ['warn', 15],
  'max-lines-per-function': ['warn', 120],
  'prefer-const': 'warn',
  'no-prototype-builtins': 'off',
  'no-constant-condition': 'off',
  'no-empty': 'off',
  'no-useless-escape': 'off'
};

const prettierRules = {
  'prettier/prettier': 'error'
};

const importRules = {
  'simple-import-sort/imports': 'error',
  'simple-import-sort/exports': 'error',
  'unused-imports/no-unused-imports': 'error',
  'unused-imports/no-unused-vars': [
    'warn',
    { vars: 'all', varsIgnorePattern: '^_', args: 'after-used', argsIgnorePattern: '^_' }
  ]
};

const typescriptRules = {
  '@typescript-eslint/consistent-type-imports': 'warn',
  '@typescript-eslint/no-explicit-any': 'error',
  // handled by unused-imports plugin
  '@typescript-eslint/no-unused-vars': 'warn',
  '@typescript-eslint/require-await': 'warn',
  '@typescript-eslint/no-unnecessary-type-assertion': 'off',
  // permissive unsafe rules — turn on per-package as needed
  '@typescript-eslint/no-unsafe-assignment': 'off',
  '@typescript-eslint/no-unsafe-call': 'off',
  '@typescript-eslint/no-unsafe-member-access': 'off',
  '@typescript-eslint/no-unsafe-return': 'off',
  '@typescript-eslint/no-unsafe-argument': 'off',
  '@typescript-eslint/restrict-template-expressions': 'off',
  '@typescript-eslint/no-unsafe-enum-comparison': 'off',
  '@typescript-eslint/no-redundant-type-constituents': 'off',
  '@typescript-eslint/no-var-requires': 'off',
  // new in typescript-eslint v8 — off to avoid breaking existing code
  '@typescript-eslint/no-unsafe-function-type': 'off',
  '@typescript-eslint/no-empty-object-type': 'off',
  '@typescript-eslint/no-require-imports': 'off',
  '@typescript-eslint/no-base-to-string': 'off',
  '@typescript-eslint/prefer-promise-reject-errors': 'off',
  '@typescript-eslint/unbound-method': 'off',
  '@typescript-eslint/no-namespace': 'off',
  // ts-comment: require description on expect-error / nocheck
  '@typescript-eslint/ban-ts-comment': [
    'warn',
    {
      'ts-expect-error': 'allow-with-description',
      'ts-ignore': true,
      'ts-nocheck': 'allow-with-description',
      'ts-check': false,
      minimumDescriptionLength: 5
    }
  ],
  '@typescript-eslint/no-unused-expressions': [
    'error',
    { allowShortCircuit: true, allowTernary: true }
  ],
  // async/await discipline
  '@typescript-eslint/promise-function-async': 'warn',
  // naming conventions — warn to avoid breaking existing code
  '@typescript-eslint/naming-convention': [
    'warn',
    // PascalCase for all type-level constructs
    { selector: ['typeLike'], format: ['PascalCase'] },
    // No "I" prefix on interfaces
    {
      selector: 'interface',
      format: ['PascalCase'],
      custom: { regex: '^I[A-Z]', match: false }
    },
    // Enums: PascalCase or UPPER_CASE
    { selector: ['enum'], format: ['PascalCase', 'UPPER_CASE'] },
    // Variables and functions: camelCase / PascalCase / UPPER_CASE; allow _ prefix
    {
      selector: ['variable', 'function'],
      format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
      leadingUnderscore: 'allow'
    },
    // Destructured props keep their original name (no format constraint)
    { selector: 'variable', modifiers: ['destructured'], format: null }
  ]
};

// ─── Per-file-type overrides ───────────────────────────────────────────────

const srcOverrides = {
  '@typescript-eslint/no-unsafe-assignment': 'warn',
  '@typescript-eslint/no-unsafe-call': 'warn',
  '@typescript-eslint/no-unsafe-member-access': 'warn',
  '@typescript-eslint/no-unsafe-return': 'warn',
  '@typescript-eslint/no-unsafe-argument': 'warn'
};

const testOverrides = {
  'no-console': 'off',
  'max-lines-per-function': ['warn', 200],
  '@typescript-eslint/no-explicit-any': 'off',
  '@typescript-eslint/require-await': 'off',
  '@typescript-eslint/promise-function-async': 'off',
  '@typescript-eslint/no-unsafe-assignment': 'warn',
  '@typescript-eslint/no-unsafe-call': 'warn',
  '@typescript-eslint/no-unsafe-member-access': 'warn',
  '@typescript-eslint/no-unsafe-return': 'warn',
  '@typescript-eslint/no-unsafe-argument': 'warn',
  '@typescript-eslint/consistent-type-imports': 'warn',
  '@typescript-eslint/no-misused-promises': 'off'
};

// ─── Factory ──────────────────────────────────────────────────────────────

/**
 * Creates an ESLint 9 flat config for a Node.js / TypeScript package.
 *
 * @param {object}          options
 * @param {string}          options.tsconfigRootDir  - directory containing the root tsconfig (required)
 * @param {string|string[]} [options.project]         - tsconfig project(s); defaults to true (nearest tsconfig.json).
 *                                                      Pass an explicit glob array for monorepo roots, e.g.
 *                                                      ['./tsconfig.eslint.json', './packages/*\/tsconfig.eslint.json']
 * @param {string[]}        [options.ignores]         - additional ignore globs
 * @param {object}          [options.rules]           - global rule overrides / additions (all files)
 * @param {object}          [options.languageOptions] - extra languageOptions (e.g. globals)
 * @param {Array<{files: string[], ignores?: string[], rules: object}>} [options.overrides]
 *        - scoped rule blocks. Each entry is appended as its own flat-config block targeting
 *          `files` (optionally excluding `ignores`), letting a consumer package add
 *          package-local rules to specific paths without touching any global rule set.
 *          Example (a consumer's own eslint.config.mjs):
 *            createNodeConfig({ tsconfigRootDir, project, overrides: [{
 *              files: ['src/builders/**\/*.ts'],
 *              ignores: ['src/builders/quoting/**'],
 *              rules: { 'no-restricted-syntax': ['error', { ... }] }
 *            }] })
 */
export function createNodeConfig(options = {}) {
  const {
    tsconfigRootDir,
    project = true,
    ignores: extraIgnores = [],
    rules: extraRules = {},
    languageOptions: extraLanguageOptions = {},
    overrides: scopedOverrides = []
  } = options;

  return typescriptEslint.config(
    // 1. Ignores
    { ignores: [...defaultIgnores, ...extraIgnores] },

    // 2. TypeScript-ESLint recommended + type-checked
    typescriptEslint.configs.recommendedTypeChecked,

    // 3. Main config block
    {
      plugins: {
        '@stylistic': stylisticPlugin,
        'simple-import-sort': simpleImportSort,
        'unused-imports': unusedImports,
        prettier: prettierPlugin
      },
      languageOptions: {
        parserOptions: {
          project,
          tsconfigRootDir
        },
        globals: {
          ...globals.node
        },
        ...extraLanguageOptions
      },
      rules: {
        ...baseEslintRules,
        ...importRules,
        ...typescriptRules,
        ...prettierRules,
        ...extraRules
      }
    },

    // 4. Stricter unsafe rules for production src files
    {
      files: ['**/src/**/*.ts'],
      rules: srcOverrides
    },

    // 5. Relaxed rules + Jest globals for test files
    {
      files: ['**/*.test.ts', '**/*.spec.ts', '**/tests/**/*.ts', '**/tests-new/**/*.ts'],
      languageOptions: {
        globals: { ...globals.jest }
      },
      rules: testOverrides
    },

    // 6. Disable all @stylistic / formatting rules that conflict with Prettier
    prettierConfig,

    // 7. Plain JS/CJS/MJS files — disable all type-checked rules (no tsconfig coverage)
    {
      files: ['**/*.js', '**/*.cjs', '**/*.mjs'],
      extends: [typescriptEslint.configs.disableTypeChecked]
    },

    // 8. Consumer-provided scoped overrides (appended last so they take precedence).
    //    Each block targets specific paths with package-local rules.
    ...scopedOverrides.map(({ files, ignores, rules }) => ({
      files,
      ...(ignores ? { ignores } : {}),
      rules
    }))
  );
}
