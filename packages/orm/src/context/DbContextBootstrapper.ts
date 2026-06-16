import type { DatabaseProvider, DbContextOptions } from '@ts-linq/core';
import { EntityCache, EntityLoader, LoadingStrategy } from '@ts-linq/core';
import { type MetadataRegistry, MetadataStorage } from '@ts-linq/metadata';
import { EnhancedSqlCache, InMemoryCountCache } from '@ts-linq/query/internal';
import { DiagnosticEmitter } from '@ts-linq/telemetry';

import { applyCompiledModel } from '../bootstrap/use-compiled-model';
import { ChangeTrackerFacade } from '../ChangeTrackerFacade';
import { DeleteCommand } from '../commands/DeleteCommand';
import { FragmentDmlExecutor } from '../commands/FragmentDmlExecutor';
import { InsertCommand } from '../commands/InsertCommand';
import { UpdateCommand } from '../commands/UpdateCommand';
import { InterceptorRegistry } from '../interceptors/InterceptorRegistry';
import { ModelBuilder } from '../ModelBuilder';
import { SpExecutor } from '../save-changes/sp-executor';
import { AuditInterceptor } from '../services/AuditInterceptor';
import { CacheCoordinator } from '../services/CacheCoordinator';
import { ChangeValidationService } from '../services/ChangeValidationService';
import { SoftDeleteInterceptor } from '../services/SoftDeleteInterceptor';
import type { DbContextServices } from './DbContextServices';

/** Mutable view used internally while the services graph is assembled. */
type MutableServices = { -readonly [K in keyof DbContextServices]: DbContextServices[K] };

/**
 * Builds a fully wired {@link DbContextServices} value object from
 * `DbContextOptions`, centralising the ~15-collaborator construction and the
 * cache/performance defaulting that previously lived inline in the
 * `DbContext` constructor (Builder/Factory pattern).
 *
 * Construction order and provider side effects (`configureSoftDelete`,
 * `attachLogger`, `configureInterceptors`, `configureQueryAnalysis`,
 * `memoryProfiler.start`) are preserved byte-for-byte with the original ctor so
 * that error propagation and runtime behaviour are unchanged.
 *
 * @internal
 */
export class DbContextBootstrapper {
  /**
   * @param options       Connection and provider configuration.
   * @param onModelCreating Virtual hook forwarded to the context subclass; invoked
   *                        once after decorator metadata is settled. Kept as a
   *                        callback because it is overridden on the `DbContext`
   *                        instance and must run during construction.
   */
  static bootstrap(
    options: DbContextOptions,
    onModelCreating: (modelBuilder: ModelBuilder) => void
  ): DbContextServices {
    const services = {} as MutableServices;

    // Initialize database provider from options
    const provider = options.provider as DatabaseProvider;
    services.provider = provider;
    services.executionStrategyOptions = options.executionStrategy;
    services.softDelete = options.softDelete;
    // Propagate soft-delete settings into provider for GlobalFilterApplier and ProviderStub
    provider.configureSoftDelete(options.softDelete);
    // Wire DiagnosticEmitter when logTo() was configured on the builder
    if (options.logging?.sink) {
      provider.attachLogger(new DiagnosticEmitter(options.logging));
    }
    services.globalFilters = options.globalFilters;
    services.diagnostics = options.diagnostics;
    // Start external memory profiler if provided
    const mp = options.diagnostics?.memoryProfiler;
    if (mp) {
      services.memoryProfiler = mp;
      mp.start?.();
    }
    services.validationService = new ChangeValidationService(
      options.validation?.translate,
      options.audit
    );

    const registry: MetadataRegistry = options.registry ?? MetadataStorage.getInstance();
    services.registry = registry;
    services.changeTracker = new ChangeTrackerFacade(registry);
    services.changeTracker.setProvider(provider);
    services.entityLoader = new EntityLoader(provider, undefined, registry);
    services.querySplittingBehavior = options.querySplittingBehavior;
    services.maxBatchSize = options.maxBatchSize ?? 0;
    services.insertCmd = new InsertCommand(provider, (c) =>
      services.cacheCoordinator.updateEntry(c)
    );
    services.updateCmd = new UpdateCommand(provider, (c) =>
      services.cacheCoordinator.updateEntry(c)
    );
    services.fragmentExecutor = new FragmentDmlExecutor(provider);
    services.spExecutor = new SpExecutor(provider, registry);
    services.deleteCmd = new DeleteCommand(
      provider,
      async (c) => services.softDeleteInterceptor.apply(c),
      (c) => services.cacheCoordinator.removeEntry(c)
    );
    // Initialize optional L2 entity cache
    if (options.performance?.enableEntityCache) {
      services.entityCache =
        options.performance.entityCache ??
        new EntityCache(
          options.performance.entityCacheSize ?? 10000,
          provider.loggerRef,
          provider.providerLabel
        );
    }
    // Create an owned SQL cache when none is supplied so that dispose() can stop its timer.
    // When the user passes their own SqlCache we leave ownership with them.
    services.ownedSqlCache = options.performance?.sqlCache ? undefined : new EnhancedSqlCache();

    // Store performance options; auto-inject per-context count cache when none supplied.
    // Preserve the original ternary form to avoid exposing a pre-existing CountCache ↔
    // InMemoryCountCache type mismatch to TypeScript's widening rules.
    services.performanceOptions = options.performance?.countCache
      ? options.performance
      : { ...options.performance, countCache: new InMemoryCountCache() };

    // Inject owned SQL cache without touching the countCache assignment above.
    if (services.ownedSqlCache) {
      services.performanceOptions = {
        ...services.performanceOptions,
        sqlCache: services.ownedSqlCache
      };
    }

    services.cacheCoordinator = new CacheCoordinator(
      services.entityCache,
      services.performanceOptions?.sqlCache,
      services.performanceOptions?.countCache,
      provider.providerLabel,
      services.performanceOptions?.cacheNamespace,
      registry,
      (ec) => registry.getEntity(ec)?.primaryKeys?.[0]
    );

    services.auditInterceptor = new AuditInterceptor(options.audit, (ec) => registry.getEntity(ec));

    services.softDeleteInterceptor = new SoftDeleteInterceptor(
      options.softDelete,
      (ec) => registry.getEntity(ec),
      async (entity, cls) => {
        await provider.update(entity, cls);
      },
      (c) => services.cacheCoordinator.updateEntry(c)
    );

    // Build InterceptorRegistry from built-in + user-supplied interceptors.
    // Built-in interceptors are added only when their respective feature is enabled.
    const builtIn: object[] = [];
    if (options.audit?.enabled) builtIn.push(services.auditInterceptor);
    if (options.softDelete?.enabled) builtIn.push(services.softDeleteInterceptor);
    services.interceptorRegistry = new InterceptorRegistry([
      ...builtIn,
      ...(options.interceptors ?? [])
    ]);

    // Configure provider with partitioned interceptors.
    provider.configureInterceptors({
      command: services.interceptorRegistry.forEachCommand(),
      connection: services.interceptorRegistry.forEachConnection(),
      transaction: services.interceptorRegistry.forEachTransaction(),
      materialization: services.interceptorRegistry.forEachMaterialization()
    });

    // Propagate query performance analysis options into provider if available
    const analysis = options.performance?.analysis;
    if (analysis) {
      provider.configureQueryAnalysis(analysis);
    }
    // Apply configurable IN() chunk size into loader
    services.entityLoader.setInChunkSize(services.performanceOptions?.inClauseChunkSize);
    services.loadingDefaults = options.loading || {};

    // Apply loading strategy from options or keep default
    const defaultLoadingStrategy = services.loadingDefaults.strategy ?? LoadingStrategy.Eager;
    services.defaultLoadingStrategy = defaultLoadingStrategy;
    services.entityLoader.setDefaultStrategy(defaultLoadingStrategy);

    if (options.compiledModel) {
      applyCompiledModel(options.compiledModel, options.compiledModelClassMap ?? {}, registry);
    }

    const modelBuilder = new ModelBuilder(registry);
    onModelCreating(modelBuilder);
    modelBuilder._finalize();
    services.entityQueryFilterMap = modelBuilder._getQueryFilterMap();

    return services;
  }
}
