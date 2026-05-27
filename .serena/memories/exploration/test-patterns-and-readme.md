# Testing Patterns and README Structure in ts-linq

## Test Infrastructure Overview

### Unit Tests
- **Location**: Within each package as `packages/<package>/src/__tests__/<feature>.test.ts`
- **Framework**: Jest with TypeScript support
- **Pattern**: Import test helpers from the package's public exports
- **Example**: `packages/core/src/spatial/__tests__/geometry.test.ts`
  - Simple factory function tests
  - Type guards (`isPoint`, `isLineString`, etc.)
  - Direct unit test coverage without DB dependency
- **Structure**:
  ```ts
  describe('<Feature> factory functions', () => {
    describe('createPoint', () => {
      it('creates a point with default SRID 4326', () => {
        const p = createPoint(10.5, 20.3);
        expect(p.type).toBe('Point');
        expect(p.srid).toBe(4326);
      });
    });
  });
  ```

### Integration Tests
- **Location**: `packages/integration-tests/tests-new/<category>/`
- **Categories**: 
  - `01-query-provider/` — cross-provider query tests
  - `02-orm-cache/` — caching behavior
  - `03-migrations-dialect/` — DDL per dialect (postgres, mysql, mssql)
  - `04-telemetry-resilience/` — logging, retry, circuit breaker, OTEL
  - `05-metadata-decorators/` — entity metadata validation
  - `06-pagination-query/` — pagination modes (offset, cursor, keyset)
  - `07-advanced-features/` — query tags, split queries, soft delete, etc.
  - `postgres/`, `mysql/`, `mssql/` — provider-specific tests
- **Setup**: Each test file creates a `TestProvider` and `DbContext`, inserts test data, validates behavior
- **Pattern**: 
  ```ts
  describe('Query Tags — integration (P2-41)', () => {
    let ctx: QtContext;
    let capturedSqls: string[];
    
    beforeEach(async () => {
      ({ ctx, capturedSqls } = makeCtx());
      await ctx.ensureCreated();
      capturedSqls.length = 0;
    });
    
    afterEach(async () => {
      if (ctx) await ctx.dispose();
    });
    
    it('tagWith() emits a leading -- comment in the SQL', async () => {
      await ctx.orders.tagWith('dashboard-top-orders').toArray();
      expect(lastSql()).toMatch(/^-- dashboard-top-orders\n/);
    });
  });
  ```
- **Key fixture**: `makeCtx()` helper that returns `{ctx, capturedSqls}` where `capturedSqls` is populated by injecting a custom `SqlLogger`
- **Timeout**: 30 seconds (vs 10s default) due to DB operations

### E2E Tests
- **Location**: `packages/e2e-tests/tests/<category>/`
- **Categories**:
  - `crud/` — basic create, read, update, delete
  - `queries/` — complex queries, filtering, ordering, pagination
  - `transactions/` — transaction scenarios, savepoints
  - `pooling/` — connection pooling behavior
  - `migrations/` — migration execution
- **Pattern**: 
  - Uses `setupTestDatabase()` from `../../src/setup` to spawn a real DB (PostgreSQL, MySQL, or MSSQL)
  - Conditionally skipped via `SKIP_DB_TESTS` env var
  - Each test:
    1. Sets up provider from test database
    2. Creates DbContext and calls `ensureCreated()`
    3. Performs DB operations
    4. Validates results
    5. Tears down in `afterAll`
- **Example**: Spatial E2E
  ```ts
  const run = process.env.SKIP_DB_TESTS !== '1';
  (run ? describe : describe.skip)('E2E Spatial (PostgreSQL / PostGIS)', () => {
    beforeAll(async () => {
      ({ harness, provider } = await setupTestDatabase('postgresql'));
      context = new TestDbContext({ provider });
      await context.ensureCreated();
      // Enable PostGIS extension if available
    });
    
    it('insert Point via WKB hex and retrieve via raw SQL', async () => {
      // ...
    });
  });
  ```

### Recent Feature Example: P2-41 (Query Tags)
- **Unit test**: `packages/query/src/__tests__/query-tags.test.ts` — tag sanitization, list accumulation
- **Integration test**: `packages/integration-tests/tests-new/07-advanced-features/queryTags.test.ts` — actual SQL emission, tag ordering in captured SQL
- **Telemetry integration**: Tags are parsed and added to OTEL span attributes via `parseTagsFromSql()` in `packages/telemetry/src/tag-span-attributes.ts`

---

## README Structure (`project-documents/tasks/dev-plans/README.md`)

### Sections

1. **Introduction** (1-5)
   - Scope and hard rules (public API mirrors EF Core verbatim)
   - Folder usage guidelines

2. **Tier Matrix** (6-89)
   - Three sections: **P0 (Foundation)**, **P1 (Important)**, **P2 (Advanced)**
   - Each tier is a markdown table with columns:
     - `#` — Task ID
     - `Title` — Linked to task file name
     - `EF Core API` — Method signatures from reference
     - `Status` — Checkbox (done ✅, in-progress, blocked, not-started)
     - `Effort` — S/M/L/XL
     - `Depends on` — Task IDs or empty
   - One tier for `RF` (Infrastructure/Refactoring)
   - **Completed tasks** use checkbox `[x]` (shown as ✅)
   - **Incomplete tasks** use checkbox `[ ]` (shown as `—`)

3. **Dependency Graph** (101-166)
   - Mermaid flowchart showing task dependencies
   - Color-coded by tier (P0 red, P1 yellow, P2 green)
   - Flow arrows show blocking relationships

4. **Glossary** (170-189)
   - EF Core terminology for non-.NET contributors

5. **Progress** (192-196)
   - Single line: `X / Y tasks done.`
   - Updated when task status changes to `done`
   - Current: `13 / 49 tasks done`

6. **Out of Scope** (200-209)
   - Explicitly excluded EF Core features (T4 templates, DI integration, etc.)

7. **Implementation Order** (212-289)
   - Critical section organizing task execution in dependency steps
   - **Step 1** — No prerequisites (16 tasks listed, including P2-45)
   - **Step 2** — Unlocked after Step 1
   - **Step 3** — Unlocked after Step 2
   - **Step 4** — Unlocked after Step 3
   - Each step shows a table with columns:
     - `Task` — Task ID
     - `Title` — Readable name
     - `Status` — Checkbox or text (✅ done, —, etc.)
   - **P2-45 is listed in Step 1** with status `—` (not started)

### Key Insight: Task Status Updates
- When a task transitions to `done`, the README must be updated in TWO places:
  1. In the **Tier Matrix** table — change status checkbox from `[ ]` to `[x]` (rendered as ✅)
  2. In the **Implementation Order** section — change status to ✅ done or appropriate state
  3. **Section 5 (Progress)** — increment the count

---

## P2-45 Context

### Task File Location
`project-documents/tasks/dev-plans/P2-45-logging-diagnostics.md`

### Current Status
- `status: not-started`
- `priority: P2`
- `effort: M`
- `depends_on: []` (no blockers)
- `ts_linq_packages_touched: [@ts-linq/orm, @ts-linq/telemetry, @ts-linq/core]`

### Four EF Core APIs to Implement
1. **`logTo(fn, level)`** — Send diagnostic events to a user-provided sink
2. **`enableSensitiveDataLogging()`** — Toggle parameter value masking in logs
3. **`enableDetailedErrors()`** — Include full stack traces in diagnostics
4. **`configureWarnings(w => w.throw(...).log(...))`** — Route warnings to throw or suppress

### Architecture
- Unified diagnostic emitter in `@ts-linq/telemetry`
- Parameter masking is **default** (opt-in for sensitive data)
- Warning route table mirrors EF Core's event ID taxonomy
- Output flows to both user LogTo sink and OTEL telemetry layer

### New Files to Create
- `packages/telemetry/src/event-ids.ts` — Event ID catalog
- `packages/telemetry/src/diagnostic-emitter.ts` — Core emitter
- `packages/telemetry/src/parameter-masker.ts` — Masking logic
- `packages/telemetry/src/warning-router.ts` — Warning escalation
- `packages/orm/src/options/{log-to,enable-sensitive-data-logging,configure-warnings}.ts` — Option builder methods

### Testing Requirements
- Unit tests for warning router
- Unit tests for sensitive-data masking toggle
- Integration tests for OTEL span attributes
- No regressions in arch checks

### Related Task
- **P2-41** (Query Tags) — already done; tags must flow into LogTo sink as structured event

---

## Integration Test Pattern for Diagnostics

Based on `packages/integration-tests/tests-new/04-telemetry-resilience/otel-provider.test.ts`:

```ts
describe('Logging & Diagnostics — integration', () => {
  let ctx: TestContext;
  let capturedEvents: DiagnosticEvent[] = [];
  
  const diagnosticSink = (event: DiagnosticEvent) => {
    capturedEvents.push(event);
  };
  
  beforeEach(async () => {
    capturedEvents = [];
    const provider = new TestProvider({ logger: {...} });
    const opts = new DbContextOptionsBuilder({ provider })
      .logTo(diagnosticSink, 'information')
      .enableSensitiveDataLogging()
      .build();
    ctx = new TestContext(opts);
    await ctx.ensureCreated();
  });
  
  it('emits parameter values when enableSensitiveDataLogging is true', async () => {
    await ctx.orders.where(o => o.id === 1).toArray();
    const lastEvent = capturedEvents[capturedEvents.length - 1];
    expect(lastEvent.parameters).toContain('1');
  });
  
  it('masks parameter values by default', async () => {
    const opts = new DbContextOptionsBuilder({ provider }).build();
    const noSensitiveCtx = new TestContext(opts);
    await noSensitiveCtx.orders.toArray();
    const lastEvent = capturedEvents[capturedEvents.length - 1];
    expect(lastEvent.parameters).toMatch(/^:p\d+/);
  });
  
  it('throws on configured warning', async () => {
    const opts = new DbContextOptionsBuilder({ provider })
      .configureWarnings(w => w.throw('core.multiple-collection-include'))
      .build();
    // ...test that warning escalates to exception
  });
});
```
