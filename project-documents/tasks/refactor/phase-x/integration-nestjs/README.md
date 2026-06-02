# Refactor Audit: integration-nestjs

## Package responsibility

`@ts-linq/integration-nestjs` is *intended* to provide a NestJS framework integration (a `DynamicModule`,
DI providers for `DbContext`, request-scoped context, decorators). Today it is an empty placeholder.

## Current architectural problems

1. **Unimplemented placeholder shipped as a package.** The entire source is one stub line.

   Evidence: `packages/integration-nestjs/src/index.ts:1-2`:
   ```ts
   // NestJS Integration - Coming Soon
   export const placeholder = 'integration-nestjs';
   ```
2. **No `@nestjs/common`/`@nestjs/core` dependency** in `package.json` (`integration-nestjs/package.json:24-28`
   lists only `typescript-config`, `@types/node`, `typescript`) — so nothing about NestJS is even modelled.
3. **No tests, no jest config** — the package has no `test` script (only `build`/`clean`/`typecheck`).
4. **Versioned `2.0.0-alpha.1`, `private: true`** — a published-shaped placeholder.
5. **Stale build artifact committed** — `tsconfig.tsbuildinfo` is tracked in the package dir.

## Refactor goals

This is a **decision** package: implement a real NestJS integration, or remove the package until it is
scheduled. The audit recommends a decision task plus, if "implement", a design task capturing what a
real integration requires.

## Recommended task order

| Order | Task | Priority | Reason |
|---:|---|---|---|
| 1 | task-1.md Decide: implement vs remove the NestJS integration | P2 | Placeholder masquerading as a deliverable |
| 2 | task-2.md (if implement) Design the NestJS integration surface | P3 | Captures DI module / request-scope requirements |

## Dependencies on other packages

- Would depend on `@ts-linq/orm` (`DbContext`) and `@ts-linq/core` (provider config), plus
  `@nestjs/common`/`@nestjs/core` as peer deps.
- The request-scoped DbContext design intersects with `plugin-multi-tenant/task-2` (ambient/request scope).

## Testing strategy

- If implemented: integration tests booting a Nest test module, asserting `DbContext` is injectable and
  request-scoped; e2e against a real provider.
- If removed: confirm nothing imports it.

## Notes

The empty placeholder is currently harmless (private), but it advertises a capability the framework does
not have. Either schedule it or remove it so the package list reflects reality.
