import { createNodeConfig } from '@ts-linq/eslint-config';

// Self-contained flat config for @ts-linq/migrations. ESLint run from this package resolves
// this config (the nearest one) instead of the repo root, so it rebuilds the shared base via
// the factory and layers a package-local, scoped guard on top.
//
// Guard (migrations/task-1): SQL builders must never interpolate a bare identifier directly
// into a dialect quote character — every identifier goes through the audited SqlQuoter
// (`q()` / `quoter.id()` / `quoter.qualified()`). The rule is scoped to `src/builders/**`
// (excluding the quoting layer itself, the sanctioned edge) so it never affects other code.
// It is paired with the precise `tests-new/quoting/no-raw-quote.test.ts` regression test.
const NO_RAW_QUOTE_SELECTOR =
  // A dialect quote char (escaped backtick, square bracket, or double quote) used as a SQL
  // delimiter glued to a `${ … }` interpolation inside a template literal.
  'TemplateElement[value.raw=/(\\`|\\[|\\]|")$/], TemplateElement[value.raw=/^(\\`|\\[|\\]|")/]';

export default createNodeConfig({
  tsconfigRootDir: import.meta.dirname,
  project: ['./tsconfig.eslint.json'],
  overrides: [
    {
      files: ['src/builders/**/*.ts'],
      ignores: ['src/builders/quoting/**'],
      rules: {
        'no-restricted-syntax': [
          'error',
          {
            selector: NO_RAW_QUOTE_SELECTOR,
            message:
              'Do not interpolate a bare identifier into a quote character. Route it through ' +
              'the audited SqlQuoter (q() / quoter.id() / quoter.qualified()) — migrations/task-1.'
          }
        ]
      }
    }
  ]
});
