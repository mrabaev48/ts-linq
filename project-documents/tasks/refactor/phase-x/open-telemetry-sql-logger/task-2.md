---
status: not-started
phase: phase-x
package: open-telemetry-sql-logger
priority: P1
effort: S
risk: low
category: typescript
depends_on: []
related: ["composite-sql-logger/task-2.md", "prometheus-sql-logger/task-2.md"]
---

# Refactor: Bind to @ts-linq/types event interfaces, drop inline parameter types

## Problem
`OpenTelemetrySqlLogger` re-declares the structural shape of every event payload
inline in its method signatures instead of importing the canonical event
interfaces from `@ts-linq/types`. The handler signatures can therefore drift
from the real `SqlLogger` contract without any compile-time error.

## Evidence
- Inline `queryStart` payload:
  `packages/open-telemetry-sql-logger/src/logger/OpenTelemetrySqlLogger.ts:75-80`.
- Inline `queryEnd` payload:
  `.../OpenTelemetrySqlLogger.ts:92-100`.
- Inline `analysis` payload:
  `.../OpenTelemetrySqlLogger.ts:118-126`.
- Canonical interfaces already exist:
  `QueryStartInfo`, `QueryEndInfo`, `QueryAnalysisInfo`, `SqlLogger`
  (`packages/types/src/index.ts:192-206`).
- `@ts-linq/telemetry` (`TelemetryProvider.ts:1-15`) and
  `@ts-linq/composite-sql-logger` both correctly import these types — this
  package is the outlier.

## Why this is bad
- Type drift: the class claims `implements SqlLogger` but its method bodies are
  typed against private, hand-copied shapes. If `QueryEndInfo` adds a field,
  this logger won't see it.
- Violates DRY and Dependency Inversion (depend on the published abstraction,
  not a private re-statement of it).
- Inconsistent with every sibling logger.

## Target architecture
- The logger depends only on the abstract event contracts owned by
  `@ts-linq/types`. No structural duplication of payload shapes anywhere in the
  package.

## Proposed refactor
1. Import `QueryStartInfo`, `QueryEndInfo`, `QueryAnalysisInfo` (and any other
   used event types) from `@ts-linq/types`.
2. Replace the inline parameter object types with those named types.
3. Remove the local `OtelLike`/`SpanLike` shapes only if they are unified by
   task-3; otherwise keep them but ensure event payloads use the shared types.

## Suggested design patterns
- **Dependency Inversion**: high-level logger depends on the type abstraction in
  `@ts-linq/types`, not on a concrete copy.

## Testing plan
- `pnpm typecheck` must pass with the shared types.
- Add a type-level test (or rely on `implements SqlLogger`) asserting each
  handler accepts the canonical `*Info` type.

## Acceptance criteria
- [ ] No inline event-payload object types remain in handler signatures.
- [ ] Handlers use `@ts-linq/types` `*Info` interfaces.
- [ ] `pnpm typecheck` passes.

## Refactor order
Do before task-3 (extraction) so the shared core can be typed against the
canonical contracts.

## Notes
Low risk, mechanical change; high payoff for contract stability.
