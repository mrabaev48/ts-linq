import * as orm from '../src';
import * as internal from '../src/internal';

/**
 * Guards the curated public surface of `@ts-linq/orm` against accidental widening
 * (refactor orm/task-6) — the most visibility-sensitive entrypoint in the repo.
 *
 * Only runtime *value* exports are observable via `import * as orm` — type-only exports
 * (interfaces, type aliases such as `FetchNextHiLoBlock`) are erased and intentionally not
 * asserted here. Adding or removing a value export from `src/index.ts` fails the allowlist
 * assertion, forcing a deliberate decision (and a changeset). Implementation-only collaborators
 * (executors, registries, coordinators, `IdentityMap`, value-generator classes) must stay off
 * the `"."` barrel and remain reachable only through `@ts-linq/orm/internal`.
 *
 * This allowlist snapshot is the **single authoritative gate** for the orm public surface
 * (orm/task-6.1 item 4), matching the `QueryPublicBarrel` precedent. `arch:dead` (ts-prune) is
 * intentionally NOT wired to also police this barrel — one gate only, to avoid divergent/duplicated
 * coverage. Change the allowlist only via a deliberate decision (and a changeset).
 */
describe('@ts-linq/orm public barrel', () => {
  const EXPECTED_VALUE_EXPORTS = [
    'ChangeTracker',
    'CollectionCollectionBuilder',
    'CollectionNavigationBuilder',
    'CollectionReferenceBuilder',
    'CoreEventId',
    'DEFAULT_POOL_SIZE',
    'DatabaseFacade',
    'DbContext',
    'DbContextFactory',
    'DbContextOptionsBuilder',
    'DbContextPool',
    'DbContextTransaction',
    'DbFunctionBuilder',
    'DbSet',
    'DbUpdateConcurrencyException',
    'DbUpdateException',
    'DiscriminatorBuilder',
    'EfWarningError',
    'EntityEntry',
    'EntityTypeBuilder',
    'IndexBuilder',
    'KeylessMutationError',
    'LocalView',
    'ModelBuilder',
    'OrmConfigurationError',
    'OwnedNavigationBuilder',
    'PooledDbContextFactory',
    'PropertiesConfigBuilder',
    'PropertyBuilder',
    'PropertyEntry',
    'QuerySplittingBehavior',
    'RelationalEventId',
    'ReferenceCollectionBuilder',
    'ReferenceNavigationBuilder',
    'ReferenceReferenceBuilder',
    'SequenceBuilder',
    'SqlInterpolated',
    'WarningConfigurationBuilder',
    'addDbContextFactory',
    'addDbContextPool',
    'resetContext',
    'sql'
  ];

  // Implementation-only collaborators moved off "." into @ts-linq/orm/internal (orm/task-6).
  const MOVED_TO_INTERNAL = [
    'BatchExecutor',
    'groupChanges',
    'chunkGroup',
    'IdentityMap',
    'InterceptorRegistry',
    'CascadeWalker',
    'JsonSnapshotter',
    'PendingModelChangesChecker',
    'HiLoValueGenerator',
    'UlidValueGenerator',
    'UtcNowValueGenerator',
    'UuidV7ValueGenerator'
  ];

  it('exports exactly the curated set of runtime value symbols', () => {
    const actual = Object.keys(orm).sort();
    expect(actual).toEqual([...EXPECTED_VALUE_EXPORTS].sort());
  });

  it.each(MOVED_TO_INTERNAL)(
    'does not leak internal collaborator %s through the main barrel',
    (symbol) => {
      expect(Object.keys(orm)).not.toContain(symbol);
    }
  );

  it.each(MOVED_TO_INTERNAL)(
    'keeps internal collaborator %s reachable through @ts-linq/orm/internal',
    (symbol) => {
      expect(Object.keys(internal)).toContain(symbol);
    }
  );

  it('keeps the four pre-existing internal services reachable through @ts-linq/orm/internal', () => {
    expect(internal.AuditInterceptor).toBeDefined();
    expect(internal.CacheCoordinator).toBeDefined();
    expect(internal.ChangeValidationService).toBeDefined();
    expect(internal.SoftDeleteInterceptor).toBeDefined();
  });
});
