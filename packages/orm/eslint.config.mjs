import { createNodeConfig } from '@ts-linq/eslint-config';

// Self-contained flat config for @ts-linq/orm. ESLint run from this package resolves this
// config (the nearest one) instead of the repo root, so it rebuilds the shared base via the
// factory and layers a package-local, scoped guard on top.
//
// Guard (orm/task-2): no empty `catch` blocks in shipped source. Every intentional swallow
// must route through the injected DiagnosticSink (`internalDiag` / `cacheStaleAfterCommit`)
// so errors on commit/rollback/cache/cleanup paths are observable instead of silently
// dropped. The base config disables `no-empty`, so we add a precise `no-restricted-syntax`
// selector that targets only empty catch bodies (a catch whose block has zero statements —
// this also flags a catch that contains nothing but a comment). Scoped to `src/**` so test
// fixtures are unaffected. Paired with the `tests-new/NoEmptyCatch.test.ts` regression gate.
const EMPTY_CATCH_SELECTOR = 'CatchClause[body.body.length=0]';

export default createNodeConfig({
  tsconfigRootDir: import.meta.dirname,
  project: ['./tsconfig.eslint.json'],
  overrides: [
    {
      files: ['src/**/*.ts'],
      rules: {
        'no-restricted-syntax': [
          'error',
          {
            selector: EMPTY_CATCH_SELECTOR,
            message:
              'Empty catch blocks are forbidden (orm/task-2). Route the swallowed error ' +
              'through the injected DiagnosticSink (internalDiag / cacheStaleAfterCommit) ' +
              'so it is observable.'
          }
        ]
      }
    }
  ]
});
