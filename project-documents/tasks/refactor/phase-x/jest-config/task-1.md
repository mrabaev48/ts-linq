---
status: not-started
phase: phase-x
package: jest-config
priority: P1
effort: M
risk: medium
category: package-boundary
depends_on: []
related: ["typescript-config/task-1.md"]
---

# Refactor: Generate and unify the module alias maps; fix stale and missing entries

## Problem

jest-config maintains the package→src alias mapping **twice** by hand — as ts-jest `paths` and
as a Jest `moduleNameMapper` — both as long literal objects. They have already drifted: a stale
alias for a deleted package and a missing alias for a package the adapter actually loads.

## Evidence

- `packages/jest-config/index.js:28` (`'@ts-linq/config': ['packages/config/src']`) and
  `:64` (`'^@ts-linq/config$': '<rootDir>/packages/config/src'`) — but **`packages/config` does
  not exist** (`ls packages/config` → No such file or directory).
- The two maps **omit `@ts-linq/transformer`** entirely, even though
  `jest-transformer.js:5` does `require('../transformer/dist/index.js')`; they also omit
  `@ts-linq/cli`.
- `index.js:14-46` (`paths`) and `:50-82` (`moduleNameMapper`) encode the same mapping in two
  syntaxes — 30+ entries each, kept in sync manually.
- `createPackageJestConfig` already uses a generic catch-all
  (`'^@ts-linq/(.*)$': '<rootDir>/../$1/src'`, `:118-121`), proving a generated mapping works.

## Why this is bad

- A stale `config` alias and a missing `transformer` alias mean the resolver lies about the
  workspace; tests can resolve to a non-existent path or fail to map a real package.
- Maintaining two parallel literal lists guarantees future drift — every new package must be
  added in two places and the root list, or it silently won't resolve under root runs.
- DRY/Single-Source-of-Truth violation for a foundational tooling concern.

## Why this is bad (catch-block audit)

Not applicable (config file).

## Target architecture

Apply **Single Source of Truth** + **generation over enumeration**:

- Derive the alias map from the actual workspace package set (read `packages/*/package.json`
  names, or use the catch-all `^@ts-linq/(.*)$` with the `query/internal` special case) so the
  list cannot drift.
- Generate the ts-jest `paths` and the `moduleNameMapper` from one source so they never
  disagree.

## Proposed refactor

1. Introduce a single `workspaceAliases()` helper that enumerates `@ts-linq/*` packages from
   the filesystem (or returns the catch-all pattern + `query/internal` override).
2. Build both `paths` and `moduleNameMapper` from that one source.
3. Remove the stale `@ts-linq/config` entries; ensure `@ts-linq/transformer` (and `cli` if
   needed) resolve.
4. Add a test asserting the generated map matches the live `packages/*` set.

## Suggested design patterns

- **Single Source of Truth / Generation** — one alias source feeds both maps. WHY: eliminates
  drift between the two hand lists and against the real workspace.
- **Convention (catch-all)** — `^@ts-linq/(.*)$`. WHY: new packages resolve automatically.

## Testing plan

- A test that reads `packages/*/package.json` names and asserts every `@ts-linq/*` package is
  resolvable and no alias points at a non-existent directory.
- Smoke a root-level run resolving `@ts-linq/transformer`.

## Acceptance criteria

- [ ] No `@ts-linq/config` alias (or any alias to a non-existent package).
- [ ] `@ts-linq/transformer` resolves under both root and per-package configs.
- [ ] `paths` and `moduleNameMapper` derive from one source; no double-maintained literals.
- [ ] A test guards the map against future drift.

## Refactor order

1. Add `workspaceAliases()` source.
2. Rebuild both maps from it; drop stale/missing fixes fall out automatically.
3. Add the drift-guard test.

## Notes

- Coordinate with typescript-config/task-1: the same alias set appears in tsconfig `paths`
  and should ideally share a generation strategy.
