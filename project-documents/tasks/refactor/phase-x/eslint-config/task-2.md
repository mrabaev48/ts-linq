---
status: not-started
phase: phase-x
package: eslint-config
priority: P2
effort: S
risk: low
category: package-boundary
depends_on: []
related: ["integration-tests/task-4.md"]
---

# Refactor: Decouple shared config from package-specific globs, tighten ts-comment, add self-test

## Problem

The shared, monorepo-wide eslint config hard-codes a directory name (`tests-new`) that belongs
to one package, permits the unsafe bare `@ts-ignore`, and has no self-test, so changes to the
factory can silently break linting everywhere.

## Evidence

- `packages/eslint-config/index.mjs:208` — the test-file override glob lists
  `'**/tests-new/**/*.ts'`, coupling the shared config to `@ts-linq/integration-tests`'s
  idiosyncratic directory name.
- `index.mjs:80` — `ban-ts-comment` sets `'ts-ignore': true`, which **allows** `@ts-ignore`
  (the no-description, unsafe suppression) while `ts-expect-error` requires a description.
- The package ships only `index.mjs` with no test (`package.json:11` `files: ['index.mjs']`),
  so a regression in the factory (wrong block order, dropped override) is undetectable until a
  consumer's lint behaves oddly.

## Why this is bad

- A shared config should not know about one package's folder layout; when integration-tests
  renames `tests-new` → `tests` (integration-tests/task-4) the override silently stops
  applying, reverting those files to strict src rules unexpectedly.
- Allowing bare `@ts-ignore` defeats the purpose of the strict `ban-ts-comment` policy — it
  lets contributors suppress type errors with zero justification, the opposite of the project's
  "Do not ignore TypeScript errors" rule.
- No self-test means the most-depended-on dev-tooling module has zero regression protection.

## Why this is bad (catch-block audit)

Not applicable (config file).

## Target architecture

Apply **decoupling** + **fixture-based testing** of the config:

- Drive the test-file override off a conventional, package-agnostic pattern (`**/*.test.ts`,
  `**/*.spec.ts`, `**/tests/**/*.ts`) and remove the `tests-new` special case; if a package
  needs an extra test dir, it passes it via the existing `options.ignores`/override hook
  rather than baking it into the shared config.
- Forbid bare `@ts-ignore` (`'ts-ignore': true` → require description or disallow).
- Add a fixture-based self-test (`RuleTester` or run-config-on-fixtures) that asserts key
  severities and overrides.

## Proposed refactor

1. Replace the `tests-new` glob with conventional test globs; coordinate with
   integration-tests/task-4's rename.
2. Set `ban-ts-comment` `'ts-ignore'` to `'allow-with-description'` (or `true`-meaning-banned
   consistently — pick the strict interpretation and document it).
3. Add a `tests/` fixture suite for the config and a `test` script + dev test runner.
4. Optionally add a typed `options` shape via JSDoc `@typedef` or a `.d.ts` for editor safety.

## Suggested design patterns

- **Convention over configuration** — standard test globs. WHY: shared config stays
  package-agnostic.
- **Fixture/Contract test for config** — `RuleTester`. WHY: regression protection for the
  most-depended-on tooling module.

## Testing plan

- Fixture suite asserting: src files get `no-unsafe-*` at the intended severity; test files
  get the relaxed set; bare `@ts-ignore` is reported; `.js` files have type-checked rules
  disabled.

## Acceptance criteria

- [ ] No package-specific directory names in the shared config.
- [ ] Bare `@ts-ignore` is disallowed (or requires a description) consistently.
- [ ] A self-test fixture suite exists and runs in CI.

## Refactor order

1. Add self-test fixtures (lock current behaviour first).
2. Tighten `ban-ts-comment`.
3. Replace `tests-new` glob (with integration-tests/task-4).

## Notes

- Sequencing: add the self-test before changing globs so the change is verified, not guessed.
