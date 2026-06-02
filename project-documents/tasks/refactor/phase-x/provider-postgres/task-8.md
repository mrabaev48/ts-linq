---
status: not-started
phase: phase-x
package: provider-postgres
priority: P2
effort: M
risk: medium
category: clean-code
depends_on: []
related: ["provider-mssql/task-2.md", "provider-mysql/task-2.md"]
---

# Refactor: Consolidate duplicated spatial (WKB/EWKB) codecs across the three providers

## Problem
Each provider ships its own `spatial-codec.ts`. `isGeometryObject` is **byte-identical** in all
three (a one-line delegate to `@ts-linq/core`'s `isGeometry`), and the WKB encoder/decoder bodies
are largely shared between MySQL and Postgres (ISO-WKB vs EWKB differ only by the SRID flag/prefix).
MSSQL adds WKT. This is substantial copy-paste of binary-encoding logic — the most error-prone kind.

## Evidence
- `isGeometryObject` identical:
  - `packages/provider-mssql/src/spatial-codec.ts:4-6`
  - `packages/provider-mysql/src/spatial-codec.ts:4-6`
  - `packages/provider-postgres/src/spatial-codec.ts:4-6`
- WKB constants duplicated: `WKB_POINT..WKB_GEOMETRYCOLLECTION`, `LITTLE_ENDIAN`:
  - `packages/provider-mysql/src/spatial-codec.ts:9-20`
  - `packages/provider-postgres/src/spatial-codec.ts:9-20` (adds `EWKB_SRID_FLAG :18`).
- `encodeWkb` (MySQL `:24`, Postgres `:24`) share the same geometry-walking structure; Postgres adds the EWKB SRID flag and `geometryToEwkbHex :248`.
- File sizes: mssql 194 LOC, mysql 220, postgres 250 — ~660 LOC of overlapping codec code.

## Why this is bad
- DRY: binary WKB encoding bugs (endianness, type codes, ring counts) must be fixed in up to three places.
- Each codec is independently exported via `index.ts`, so consumers can import three subtly different `decodeWkb` implementations.
- High-risk duplication: encoding bugs are silent and data-corrupting.

## Target architecture
Extract a shared spatial codec into `@ts-linq/core` (which already owns the `Geometry` model and
`isGeometry`) or a dedicated `@ts-linq/spatial-codec` package — note the boundary decision in the
PR. Provide a single WKB core with a small variation seam for ISO-WKB (MySQL), EWKB
(Postgres, SRID flag + hex), and WKT (MSSQL). Each provider re-exports / configures the shared
codec rather than reimplementing it. SOLID: DRY, SRP (one codec owner), OCP (add a format via the
seam), composition over copy-paste.

## Proposed refactor
1. Move `isGeometryObject` + WKB constants + the geometry-walk to a shared module.
2. Parameterize the SRID handling (none / EWKB flag / WKT) via a strategy or options.
3. Have each provider import the shared codec; keep thin provider-specific wrappers only where the wire format genuinely differs.
4. Deduplicate the codec tests into a shared spec with per-format cases.

## Suggested design patterns
- **Strategy** — WKB vs EWKB vs WKT formatting behind one core.
- **Template Method** — shared geometry traversal with format hooks.
- **Composition over inheritance / DRY**.

## Testing plan
- Unit: shared codec round-trips Point/LineString/Polygon/Multi* for each format.
- Unit: EWKB SRID flag + hex prefix; MySQL no-SRID; MSSQL WKT.
- Regression: existing `tests-new/spatial-codec.test.ts` in all three providers pass against the shared codec.

## Acceptance criteria
- [ ] `isGeometryObject` defined once and reused.
- [ ] WKB constants + geometry traversal exist in one shared module.
- [ ] Per-provider files contain only genuine format differences.
- [ ] Boundary placement justified; `pnpm arch:deps`/`arch:cycles` pass.
- [ ] Shared codec spec covers all formats; provider codec tests pass.

## Refactor order
Independent of the provider god-class work; can land any time. Pairs conceptually with the
mapper/coercer extraction (`provider-mssql/task-2.md`) since both target cross-provider DRY.

## Notes
Cross-cutting codec duplication; filed under postgres (the most feature-complete codec: EWKB + hex
+ string decode). MSSQL hierarchy-codec (`hierarchy-codec.ts`) and Postgres ltree-codec
(`ltree-codec.ts`) are small and dialect-specific — leave them in place.
