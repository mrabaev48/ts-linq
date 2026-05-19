# ISSUE-023: dependency-cruiser Rules Produce 790 False-Positive Violations, Masking Real Errors

## Severity

High

## Category

- Build/Tooling
- Maintainability

## Location

- `.dependency-cruiser.cjs`
- `pnpm arch:deps` output (`reports/dependency-cruiser.json`)

## Problem

Running `pnpm arch:deps:json` produces **811 total violations**, of which only **5 are real errors**. The remaining 806 are noise:

| Rule | Severity | Count | Issue |
|------|----------|-------|-------|
| `no-circular` | error | 5 | Real violations (ISSUE-001, ISSUE-021) |
| `no-any-in-internal-api-files` | info | 411 | **All intra-package** — rule matches same-package imports, not cross-package `any` leakage |
| `no-private-package-internals` | warn | 379 | **All intra-package** — rule matches same-package file-to-file imports, not cross-package internal reach-ins |
| `no-orphans` | warn | 16 | 9 are test/config files (acceptable); 7 are real production orphans (ISSUE-022) |

**`no-private-package-internals`** is intended to prevent packages from importing another package's internal files (bypassing its `index.ts`). However, the current regex configuration matches any import path that contains package-internal file references — including imports **within** the same package. The result: 379 warnings all of the form `packages/foo/src/a.ts → packages/foo/src/b.ts` (same package), which are valid internal imports.

**`no-any-in-internal-api-files`** has a similar problem: 411 intra-package violations, not the cross-package type leakage the rule was presumably designed to catch.

With 806 false-positive warnings drowning 5 real errors, any developer running `pnpm arch:deps` will either ignore the output entirely or struggle to find the actual rule violations.

## Evidence

`pnpm arch:deps:json` summary:
```
Total violations: 811
Errors: 5 | Warns: 395 | Info: 411
```

Sample `no-private-package-internals` violation (intra-package, both files in `packages/ast/`):
```
from: packages/ast/src/ast/SqlVisitor.ts
to:   packages/ast/src/ast/Nodes.ts
```

Cross-package `no-private-package-internals` violations: **0** — the rule produces zero cross-package detections despite its intended purpose.

## Why It Matters

- **Signal-to-noise**: 806 false positives make it impossible to use `pnpm arch:deps` as a meaningful CI gate without ignoring the output.
- **Hidden real violations**: The 5 actual errors (circular deps) are buried in a wall of warnings.
- **Rule intent defeated**: `no-private-package-internals` is supposed to prevent packages from reaching into each other's internals — but it currently catches zero such violations while generating 379 irrelevant warnings.
- **Developer trust**: When a tool consistently produces overwhelming false positives, developers stop trusting and checking it.

## Recommended Fix

Fix the two misconfigured rules in `.dependency-cruiser.cjs`:

**1. `no-private-package-internals`** — scope the rule to cross-package imports only:
```js
{
  name: 'no-private-package-internals',
  severity: 'warn',
  from: { path: '^packages/([^/]+)/' },
  to: {
    path: '^packages/([^/]+)/src/',
    // Only flag when "from" package differs from "to" package
    pathNot: '^packages/$1/'  // same package — allowed
  }
}
```

**2. `no-any-in-internal-api-files`** — clarify its intent or remove it. If the goal is to flag `any` usage in public API types, use a TypeScript ESLint rule (`@typescript-eslint/no-explicit-any`) instead, which is more precise.

**3. `no-orphans`** — exclude test infrastructure paths to reduce noise:
```js
{
  name: 'no-orphans',
  from: { pathNot: '(test|spec|jest|setup|fixture|sequencer|e2e)' }
}
```

## Acceptance Criteria

- `pnpm arch:deps` produces ≤ 20 total violations in a clean codebase state.
- `no-private-package-internals` correctly identifies cross-package internal imports and produces zero false positives for intra-package imports.
- Real `no-circular` errors remain clearly visible as errors in the output.
- CI fails on `no-circular` errors without being suppressed by warning noise.
