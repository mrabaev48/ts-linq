---
status: completed
phase: phase-x
package: core
priority: P2
effort: M
risk: low
category: package-boundary
depends_on: []
related: ['core/task-1.md']
---

# Refactor: Tame the `@ts-linq/core` barrel and clarify the package's contents vs comments

## Problem
`packages/core/src/index.ts` mixes backward-compat re-exports from `@ts-linq/types`,
core-only types, decorators, base provider abstractions, spatial, hierarchy, owned-entity
hydration, and interceptors, with a scattering of "moved to package X" comments and a
commented-out export. The package's responsibility is unclear: it is simultaneously a
provider base, a decorator host, a value-object library (spatial/hierarchy), and a
hydration toolkit. Several `export *` barrels widen the public surface uncontrollably.

## Evidence
- `packages/core/src/index.ts:81` — `// export * from './utils/InternalLogger'; // Removed` (dead comment; the symbol is still imported internally).
- `index.ts:48-58` — comments "moved to @ts-linq/orm/query/migrations" interleaved with live exports (documentation drift risk).
- `export *` from `./decorators/*`, `./spatial`, `./hierarchy`, `./utils/*`, `./OwnedEntityHydrator` (lines 41-91) — re-exports everything in those modules, including helpers not intended as public API (e.g. `hydrateJsonObjectPlain` internals are file-local but `hydrateTableSplit`/`hydrateJson` become public).
- `index.ts:6` "Backward-compatible re-exports" — `@ts-linq/core` re-exports `@ts-linq/types` symbols, so the same type has two import paths.

## Why this is bad
- **API stability**: `export *` means any new symbol in a sub-module silently becomes public API; hard to evolve.
- **Discoverability**: duplicate import paths (core vs types) confuse consumers and complicate deprecations.
- **Cohesion**: spatial/hierarchy value objects arguably belong in their own package, not the provider-base package.

## Target architecture
Make the public surface explicit and intentional. Replace `export *` with named exports for
the curated public API. Decide whether spatial/hierarchy are first-class sub-packages or stay
in core, and document it. Remove backward-compat re-exports (or mark them `@deprecated`) so
each type has one canonical import path. Apply Interface Segregation at the package level.

## Proposed refactor
1. Convert `export *` to explicit named exports for the intended public API; keep internals unexported.
2. Remove the dead `// export * from './utils/InternalLogger'; // Removed` line.
3. Replace "moved to X" comments with a short `README`/module doc rather than inline-in-barrel notes.
4. Mark `@ts-linq/types` re-exports `@deprecated "import from @ts-linq/types"` to steer to one path.
5. Run `pnpm arch:dead` / `ts-prune` to confirm no internal-only symbol is exported.

## Suggested design patterns
- **Facade** — a curated barrel is the package facade; internals stay private.
- **Interface Segregation** at module level.

## Testing plan
- Build/`ts-prune`: no unintended public symbols; no dead exports.
- Type-level: public types still resolvable from their canonical path.

## Acceptance criteria
- [ ] No `export *` in `core/src/index.ts` except where every symbol is genuinely public.
- [ ] Dead/commented export lines removed.
- [ ] Duplicate type paths deprecated or removed.
- [ ] `arch:dead` reports no new dead code; validations pass.

## Refactor order
Low risk; do after the structural splits (`core/task-1`/`task-3`) so the final public surface is exported once.

## Notes
Reassess whether `spatial` and `hierarchy` value-object trees deserve their own packages — that is a larger architectural call; capture as a follow-up investigation if out of scope.
