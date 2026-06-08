---
status: completed
phase: phase-x
package: metadata
priority: P2
effort: S
risk: medium
category: error-handling
depends_on: []
related: []
---

# Refactor: Harden the reflect-metadata fallback in `MetadataRegistry.getEntity`

## Problem
`MetadataRegistry.getEntity` wraps its happy path in a `try/catch` that, on *any* error,
silently falls into a second resolution path. The catch has no binding and no diagnostic —
if `reflectGetOwnMetadata` or `normalizeTarget` throws for an unexpected reason, the failure
is invisible and the method may return a subtly different (un-rebased) metadata object.

## Evidence
- `packages/metadata/src/MetadataRegistry.ts:218-239` `getEntity` — the `try` block (220-230) and the bare `catch { ... }` fallback (231-238).
  Classification: **invalid silent swallow / unsafe fallback** — the catch changes behaviour (skips the `original !== target ? {...meta, target} : meta` rebasing at line 230) with no signal.
- `packages/metadata/src/reflectUtils.ts:1-13` — `reflectGetOwnMetadata` itself has a `catch { /* ignore */ }` (line ~?) returning `undefined`.
  Classification: **borderline** — reflect-metadata may be absent; returning `undefined` is a legitimate capability check, but it should be a single documented capability probe, not an ad-hoc swallow.

## Why this is bad
- **Debugging risk**: a genuine bug in normalization is masked as "fall back and continue".
- **Behavioural divergence**: the two branches return differently-shaped metadata (one rebases `target`, the other does not).
- **Consistency**: metadata already uses typed `ValidationError` elsewhere; this swallow bypasses the convention.

## Target architecture
Make the reflect-metadata presence a single explicit capability check (Null Object /
capability probe) performed once, not a per-call try/catch. The two resolution branches
should converge on identical metadata shaping so the fallback cannot silently change output.
Any *unexpected* error should propagate (or be wrapped in a typed `MetadataError` with cause),
not be swallowed.

## Proposed refactor
1. Extract a `private resolveOriginal(target): Function` that uses the capability-checked reflect probe and never throws for control flow.
2. Collapse the two `getEntity` branches into one path that always applies the `target`-rebasing logic.
3. If reflect access genuinely can fail, wrap in a typed `MetadataError('REFLECT_UNAVAILABLE', …, { cause })` rather than a bare catch.
4. Keep `reflectGetOwnMetadata` as the single capability probe; document that `undefined` means "no reflect-metadata / no entry".

## Suggested design patterns
- **Capability probe / Null Object** — one place decides whether reflect-metadata exists.
- **Guard clause** — explicit early returns instead of try/catch control flow.
- **Result/typed-error** — unexpected failures surface, not vanish.

## Testing plan
- Unit: `getEntity` returns identically-shaped metadata whether or not reflect-metadata is present.
- Error-path: an injected throwing normalizer surfaces a typed error (not a silent fallback).
- Regression: existing decorator/fluent metadata resolution unchanged.

## Acceptance criteria
- [ ] `getEntity` no longer uses try/catch for control flow.
- [ ] Both resolution paths yield the same metadata shape (target rebasing consistent).
- [ ] Reflect availability is a single documented probe.
- [ ] Cluster validations pass.

## Refactor order
After `metadata/task-3` (artifact removal) and ideally with `metadata/task-2` (registry split), since both touch `getEntity`/normalization.

## Notes
Verify whether decorators legitimately depend on the silent fallback (e.g. when `reflect-metadata` is not imported in some test setups) before tightening — add a capability test for the no-reflect environment.
