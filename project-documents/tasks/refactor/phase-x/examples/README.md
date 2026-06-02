# Refactor Audit: examples

## Package responsibility

`@ts-linq/examples` is *intended* to host runnable code examples demonstrating the ORM. Today it is an
empty placeholder containing one stub line.

## Current architectural problems

1. **Empty placeholder.** Entire source:

   `packages/examples/src/index.ts:1-5`:
   ```ts
   // Examples - Coming Soon
   // This package will provide runnable code examples
   export const placeholder = 'examples';
   ```
2. **It is built (`tsc`) but never run** — `build`/`clean`/`typecheck` scripts only; no `start`/`example`
   script, no executable entry. A non-runnable "examples" package.
3. **Masks a real gap:** there is no consumer-facing smoke test that exercises the public API the way a
   user would (import from `@ts-linq/orm`, define entities, run a query). The examples package is the
   natural home for that and currently provides none.
4. **Stale committed `tsconfig.tsbuildinfo`**, `private: true`, versioned `2.0.0-alpha.1`.

## Refactor goals

Decide: turn `examples` into a real, runnable, CI-exercised set of consumer-facing samples (doubling as
public-API smoke tests), or remove it. The audit recommends turning it into runnable smoke examples,
because that closes a genuine end-to-end coverage gap.

## Recommended task order

| Order | Task | Priority | Reason |
|---:|---|---|---|
| 1 | task-1.md Decide & either populate runnable examples or remove | P2 | Placeholder; also a hidden public-API smoke-test gap |

## Dependencies on other packages

- Would depend on `@ts-linq/orm`, `@ts-linq/core`, and a provider (e.g. `@ts-linq/provider-*`) to be
  runnable end-to-end.

## Testing strategy

- Examples should be executed in CI (each example is itself a smoke test that the public API compiles
  and runs against a real/in-memory provider).

## Notes

The danger of an empty `examples` package is that it looks like documentation/coverage exists when it
does not. Per project rule §5, there is a `tests:e2e` suite; examples should complement, not duplicate,
it by demonstrating the *public consumer entry points* specifically.
