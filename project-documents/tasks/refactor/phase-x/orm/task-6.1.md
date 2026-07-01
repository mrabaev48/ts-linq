---
status: completed
phase: phase-x
package: orm
priority: P2
effort: M
risk: medium
category: package-boundary
depends_on: [task-6]
related: [task-7]
---

# Refactor: task-6 follow-ups — harden the public/internal boundary & query coupling

## Problem

`orm/task-6` established the two-tier surface (curated `"."` + opt-in
`@ts-linq/orm/internal`), but left six documented tech-debt items behind. This task
consolidates and resolves (or explicitly accepts, with a recorded decision) all of
them so no loose ends remain from the boundary refactor.

## Scope — the six items

### 1. orm ↔ `@ts-linq/query/internal` is still build-coupled (primary)

The original task-6 goal — remove the "build-layout coupling" to query — was **not**
achieved: the tsconfig `paths` alias
`"@ts-linq/query/internal": ["../query/dist/internal"]`
([packages/orm/tsconfig.json](../../../../../packages/orm/tsconfig.json)) remains.

Root causes (all verified during task-6):
- Classic `moduleResolution: node`
  ([packages/typescript-config/base.json](../../../../../packages/typescript-config/base.json))
  does **not** read `package.json` `exports`, so removing the alias breaks `tsc`.
- Retargeting `dist → src` breaks orm's **composite ESM emit** (`tsc` pulls
  `query/src/internal/*.ts` outside orm's `rootDir` → TS6059/6307; CJS survives via
  project-reference redirect, ESM does not).
- orm also imports the **intentionally-internal** `QueryContext`/`QueryContextProps`
  from `@ts-linq/query/internal`
  ([packages/orm/src/context/QueryableFactory.ts:3](../../../../../packages/orm/src/context/QueryableFactory.ts)),
  so the alias is unremovable even if the cache classes moved.

**Deliverable:** a decision, not necessarily code. Evaluate the real options and
either implement one or record an explicit "accept as-is" with rationale:
- (a) **Accept as sanctioned channel** (recommended default): dependency-cruiser's
  `no-query-internal-from-non-collaborators` rule already whitelists `orm`
  ([.dependency-cruiser.cjs](../../../../../.dependency-cruiser.cjs)); it mirrors how
  `@ts-linq/query` consumes `@ts-linq/sql-visitor/internal` (`../sql-visitor/dist/internal`).
  Document the invariant in `packages/orm/CLAUDE.md`; no code change.
- (b) **Relocate shared abstractions** — move `EnhancedSqlCache`/`InMemoryCountCache`
  **and** `QueryContext`/`QueryContextProps` to a neutral shared location so orm imports
  them from a public entrypoint and the alias is fully dropped. This is a large
  cross-package change (touches `@ts-linq/query` public API and possibly a new shared
  module) — only pursue if (a) is rejected.
- (c) **Switch orm to `moduleResolution: bundler`/`node16`** so `exports` is honoured —
  investigated and found **infeasible** for a composite commonjs-emitting package
  (bundler disallows cjs emit; node16 requires `.js` extensions on every relative import).
  Record as rejected.

### 2. `FetchNextHiLoBlock` type is public without its class

The type is exported from `"."`
([packages/orm/src/index.ts](../../../../../packages/orm/src/index.ts)) while
`HiLoValueGenerator` now lives in `@ts-linq/orm/internal`. A consumer can type the
block-fetch callback but cannot construct the generator from the public API.

**Deliverable:** pick one and apply — either (a) keep the type public and add a short
`@public` TSDoc note explaining it is a user-implemented callback type independent of
the internal generator; or (b) move the type into the `/internal` contract alongside the
class. Update the `OrmPublicBarrel` allowlist accordingly if the set changes (type-only
exports are not in the runtime allowlist, but keep the intent documented).

### 3. `@public`/`@internal` TSDoc is barrel-level, not per-symbol

task-6 added header-level annotations to `src/index.ts` and `src/internal/index.ts`
only. Retained advanced public exports do not all carry per-symbol `@public`, and
moved symbols do not all carry `@internal`.

**Deliverable:** add consistent per-symbol `@public`/`@internal` TSDoc on the advanced
exports where it aids discoverability (do not bloat trivial builders). Keep it
proportional — the goal is a clear, greppable contract, not annotation for its own sake.

### 4. Public-API gate uses an explicit allowlist, not `ts-prune`

task-6 shipped `OrmPublicBarrel.test.ts` (explicit 42-symbol allowlist snapshot),
matching the `QueryPublicBarrel` precedent. `arch:dead` (ts-prune,
[ts-prune-ignore.txt](../../../../../ts-prune-ignore.txt)) does not specifically stere
the orm barrel.

**Deliverable:** confirm the allowlist test is the intended gate and document that
choice, OR (if a static gate is preferred) wire a ts-prune-based check for the orm
public surface. Do **not** duplicate coverage — one authoritative gate only.

### 5. `@ts-linq/orm/internal` resolution is verified structurally, not by dual-package execution

task-6 verifies the subpath via jest (mapped to `src`) + presence of build artifacts +
the `exports` map. A real Node `require()` **and** `import` of `@ts-linq/orm/internal`
against the built `dist` is not asserted (direct node execution currently fails due to
the repo-wide manual-ESM extension-less-import hazard, which affects all packages).

**Deliverable:** add a lightweight dual-package resolution smoke check (e.g. a script or
CI step that `require`s the cjs entry and dynamically `import`s the esm entry of
`@ts-linq/orm/internal` from `dist`), or record that this is blocked by the pre-existing
ESM-emit hazard and cross-reference the repo-level follow-up. Prefer the smallest check
that actually exercises both conditions of the `exports["./internal"]` map.

### 6. Stray compiled artifacts can pollute `packages/*/src` and break ts-jest

During task-6, 180 untracked `.js`/`.d.ts`/map files were found under
`packages/query/src/` (not gitignored). ts-jest resolved the stray `.js` before the
`.ts`, producing `SyntaxError: Unexpected token 'export'` when importing a package
barrel. CI is clean (fresh checkout) but local dev is fragile.

**Deliverable:** prevent recurrence — add an ignore rule (e.g. `.gitignore` entries for
compiled artifacts under `packages/*/src/**` such as `*.js`, `*.d.ts`, `*.d.ts.map`,
`*.js.map`, being careful not to ignore genuine hand-written `.js`/`.d.ts` sources if
any exist), and/or identify the build path that emits into `src` and fix the
misconfiguration. Add a short note to the repo docs so future sessions clean stray
artifacts instead of chasing phantom test failures.

## Why this is worth doing

- Closes the one acceptance criterion task-6 could not satisfy (the query deep-import),
  either by fixing it or by turning an implicit constraint into a recorded decision.
- Removes small inconsistencies (public type without its class; uneven TSDoc) that erode
  the value of the new boundary.
- Hardens the toolchain so the boundary gate and the workspace stay reliable.

## Suggested design patterns

- **Published-language boundary / Facade** — the package entrypoint is the contract;
  internals stay behind `@ts-linq/orm/internal`.
- **Dependency Inversion at the package boundary** — if item 1(b) is chosen, orm depends
  on a shared abstraction, not on another package's build layout.

## Testing plan

- Keep and extend `OrmPublicBarrel.test.ts` / `OrmInternalSubpath.test.ts`; update the
  allowlist only via a deliberate decision.
- If item 1(b) is implemented: `arch:deps` must show orm no longer resolves into
  `packages/query/src/internal`; full build + downstream builds pass.
- If item 5 is implemented: the dual-package smoke check passes for both cjs and esm.
- No existing test may be deleted, weakened, or skipped.

## Acceptance criteria

- [ ] Item 1: query coupling either decoupled (alias removed) or explicitly accepted with
      a documented rationale in `packages/orm/CLAUDE.md` + this task's notes.
- [ ] Item 2: `FetchNextHiLoBlock` public/internal placement decided and applied with TSDoc.
- [ ] Item 3: consistent per-symbol `@public`/`@internal` TSDoc on advanced exports.
- [ ] Item 4: single authoritative public-API gate, documented.
- [ ] Item 5: dual-package (cjs+esm) resolution of `@ts-linq/orm/internal` asserted or the
      blocker recorded with a cross-reference.
- [ ] Item 6: stray `src` artifacts prevented (ignore rule and/or emit-path fix) + doc note.
- [ ] `pnpm typecheck && pnpm lint && pnpm build && pnpm arch:deps && pnpm arch:cycles && pnpm arch:dead` pass.
- [ ] Full `pnpm test:all` green.

## Notes

- This task is mostly **hygiene + one architectural decision**; it is expected to be a
  `patch` for `@ts-linq/orm` unless item 1(b) or item 2(b) changes a public API (then
  bump accordingly — item 1(b) touching `@ts-linq/query`'s public surface would be a
  `minor`/`major` on `query`). Choose the changeset per CLAUDE.md §14 after the approach
  is fixed.
- Item 1(c) (`moduleResolution` change) was already investigated in task-6 and found
  infeasible for a composite cjs-emitting package — do not re-litigate; record as rejected.

## Resolution (completed)

- **Item 1 → option (b) via a public seam (decoupled).** Rejected (a) accept-as-is and (b2)
  relocate-to-new-package (infeasible: `QueryContext` transitively pulls the query-internal
  `SqlVisitorFactory`; `EnhancedSqlCache` pulls the Lru/Ttl/Metrics cache stack). Instead
  `@ts-linq/query` now publishes a boundary seam in `packages/query/src/QueryableFactory.ts`
  (re-exported from `src/index.ts`): `createQueryable` / `createRawSqlQueryable` hide the internal
  `QueryContext`; `createDefaultSqlCache` (→ public `OwnedSqlCache`) / `createDefaultCountCache`
  (→ public `CountCache`) hide the concrete cache classes; new public `QueryableSeedProps`
  (= `QueryContextProps` minus the internal `visitorFactory`, which `QueryContextProps` now
  `extends`). orm's 4 source imports were repointed to `@ts-linq/query`, the tsconfig `paths`
  alias to `../query/dist/internal` was **removed**, and `.dependency-cruiser.cjs` now forbids
  orm from importing `@ts-linq/query/internal` (only `integration-tests` remains whitelisted).
  `arch:deps` confirms orm no longer resolves into `packages/query/src/internal`. Changeset:
  `@ts-linq/query` **minor** (new public seam), `@ts-linq/orm` **patch**.
- **Item 2 → (a) keep public.** `FetchNextHiLoBlock` stays on `@ts-linq/orm` with a per-symbol
  `@public` TSDoc note clarifying it is a user-implemented callback independent of the internal
  `HiLoValueGenerator` class. No public-API change.
- **Item 3 → per-symbol TSDoc.** Added proportional `@public` annotations to the advanced exports
  in `src/index.ts` (SequenceBuilder, EntityEntry/PropertyEntry/graph-node, LocalView + types,
  `sql`/`SqlInterpolated`, `FetchNextHiLoBlock`) and per-symbol `@internal` in `src/internal/index.ts`.
- **Item 4 → single gate documented.** `OrmPublicBarrel.test.ts` is the sole authoritative gate;
  documented in its header + `packages/orm/CLAUDE.md`. ts-prune deliberately NOT wired to also
  police the barrel (no duplicate coverage).
- **Item 5 → dual-package smoke check + recorded blocker.** `packages/orm/scripts/smoke-internal-resolution.cjs`
  (npm `smoke:internal`) hard-asserts that `exports["./internal"]` declares require/import/types and
  that each target exists in `dist` (deterministic), then best-effort `require()`s the cjs entry and
  `import()`s the esm entry. Both runtime resolutions are **blocked by a pre-existing, repo-wide
  hazard**: ESM-only leaf packages (notably `@ts-linq/ast`) emit relative imports without a `.js`
  suffix, which Node's ESM loader rejects (`ERR_MODULE_NOT_FOUND`) — it is transitive and breaks even
  `require('@ts-linq/orm')` of the PUBLIC entry, so it is not introduced by the internal subpath. The
  script records it (exit 0) and cross-references the repo-level ESM-emit follow-up.
- **Item 6 → stray-artifact guard.** Root `.gitignore` now ignores `*.js`/`*.js.map`/`*.d.ts`/`*.d.ts.map`
  under `packages/*/src/**` (negating the one genuine hand-written source,
  `packages/e2e-tests/src/jest-transformer.js`), preventing a misdirected `tsc` from polluting `src`
  and causing phantom ts-jest `SyntaxError` failures. Note added here + in the top-level refactor README.

> **Repo-doc note (item 6):** if ts-jest reports `SyntaxError: Unexpected token 'export'` when
> importing a package barrel, check for stray compiled `.js`/`.d.ts` under `packages/*/src` and delete
> them — they are now gitignored, but a pre-existing local checkout may still have them.

---

## Execution workflow (per `TASK_TEMPLATE.md`)

### Role
Senior/Principal TypeScript Software Architect working inside the ts-linq monorepo.

### Mandatory tooling
- **Serena MCP** — all navigation, symbol/reference analysis, and code edits.
- **Context7 MCP** — TypeScript module-resolution / `exports` behaviour, tooling docs.
  Never rely on training memory.

### Step 0 — Serena setup
Activate the Serena project.

### Step 1 — Branch setup
Pull latest `main`; create a branch (e.g. `audit-refactor/orm-boundary-followups`) from it.

### Step 2 — Planning & architecture
Invoke `/engineering:architecture`, `/engineering:system-design`, `/clean-architecture`.
Read this file fully. Inspect `packages/orm/src/index.ts`, `src/internal/index.ts`,
`tsconfig.json`, `QueryableFactory.ts`, `.dependency-cruiser.cjs`, and `packages/jest-config`.
Produce a short, file-level plan and **get it approved before writing code** — item 1 in
particular is a decision that must be confirmed (accept-as-is vs relocate).

### Step 3 — Implementation
Follow CLAUDE.md §4. Apply `/ts-library`, `/typescript-expert`,
`/code-refactoring-refactor-clean-v2`, `/turborepo` (tsconfig/exports/build wiring).
Make minimal, precise changes; preserve public API unless a decided item changes it.

### Step 4 — Testing
Invoke `/engineering:testing-strategy`. Extend the barrel/subpath gates; add the
dual-package smoke check (item 5) if implemented. Unit + type-level coverage for any code.

### Step 5 — Security review
Invoke `/security-review` — check for `any` leaks in the public surface and that no
internal is re-exposed.

### Step 6 — Validation
Run in order, fix any failure at the root, re-run until all green:
```bash
pnpm typecheck
pnpm lint
pnpm test:unit
pnpm test:integration   # foreground only — integration/e2e hang in background
pnpm test:e2e           # foreground only
pnpm build
pnpm arch:deps
pnpm arch:cycles
pnpm arch:dead
```

### Step 7 — Self-review
Invoke `/code-review`, `/engineering:code-review`, `/simplify`. Fix high-confidence findings.

### Step 8 — Verify
Invoke `/verify` — confirm `@ts-linq/orm` and `@ts-linq/orm/internal` resolve and behave
as intended end-to-end.

### Step 9 — Tech-debt check
Invoke `/engineering:tech-debt`. Any residual item must be recorded (ideally none remain
after this task).

### Step 10 — Documentation
Invoke `/engineering:documentation`. Update:
- this file's frontmatter → `status: completed`;
- `project-documents/tasks/refactor/phase-x/orm/README.md` (mark task-6.1 done; keep
  package `🔄 In Progress` while tasks 7–8 remain);
- `project-documents/tasks/refactor/README.md` completion tracking;
- `packages/orm/CLAUDE.md` (the query-internal invariant, if item 1(a) chosen).

### Step 11 — Serena memory update
Record the decisions (esp. item 1 outcome), any API changes, and validation results.

### Step 12 — Changeset
Create a changeset per CLAUDE.md §14 — `patch` for `@ts-linq/orm` by default; escalate if
a decided item changes a public API (and add a `@ts-linq/query` changeset if item 1(b)).

### Step 13 — Commit + PR
Invoke `/engineering:deploy-checklist`. Commit with the changeset; open a PR to `main`
describing each of the six items, the decision taken for item 1, files/packages touched,
and the final status of every check.

### Completion criteria
All six acceptance-criteria boxes above are checked; the monorepo builds; all checks pass
with zero errors; docs, Serena memory, changeset, and PR are complete.

### Language
Always respond and write in **Russian**.
