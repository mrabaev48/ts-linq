# TypeScript ORM Framework - Детальный Roadmap на Будущее

**Дата создания**: 23 октября 2025  
**Текущий статус**: ✅ Build: 34/34 пакета, архитектура чистая, тесты: 266 файлов

---

## 📊 Приоритизация

**P0** = Критично для production  
**P1** = Высокий приоритет  
**P2** = Средний приоритет  
**P3** = Nice to have

---

## PHASE 0: Critical Type Safety Restoration ✅ (COMPLETED)

> **КРИТИЧЕСКАЯ НАХОДКА**: TypedQueryable был удалён по ошибке при рефакторинге

### 0.1 TypedQueryable Restoration ✅ (COMPLETED)

**Проблема**: При переходе на модульную архитектуру был удалён TypedQueryable - критически важный wrapper для compile-time type safety.

**Что даёт TypedQueryable**:
- ✅ Compile-time validation для `.select()` - нельзя выбрать несуществующее поле
- ✅ Compile-time validation для `.include()` - только relationships разрешены
- ✅ Type-safe relationships через `RelationshipProperties<T>`
- ✅ Entity Framework API compatibility (`.except()`, `.intersect()`, `.concat()`)

**Решение**: ✅ Восстановлен в `packages/query/src/TypedQueryable.ts`

**Пример использования**:
```typescript
import { typed } from '@ts-linq/query';

// Обычный Queryable - no compile-time checks
const query1 = ctx.users.select(u => ({ invalid: u.nonExistent })); // ✅ Компилируется

// TypedQueryable - строгая типизация
const query2 = typed(ctx.users).select(u => ({ invalid: u.nonExistent })); // ❌ COMPILE ERROR!
```

---

## PHASE 1: Production Readiness & Stability (2-3 недели)

> **Цель**: Подготовить фреймворк к публичному релизу

### 1.1 Завершение тестового покрытия (P0) - 4 дня

**Задача**: Довести покрытие до 95%+

**Шаги**:

1. **День 1: Snapshot Testing для SQL**
   ```bash
   # В каждом dialect пакете добавить:
   packages/dialect-{provider}/tests/snapshots/
   ├── select-queries.test.ts
   ├── ddl-statements.test.ts
   ├── joins-and-subqueries.test.ts
   └── __snapshots__/
       └── *.snap
   ```
   
   Пример теста:
   ```typescript
   // packages/dialect-postgres/tests/snapshots/select-queries.test.ts
   import { PostgresDialect } from '../src';
   
   describe('PostgreSQL SELECT Snapshots', () => {
     const dialect = new PostgresDialect();
     
     test('simple WHERE with params', () => {
       const sql = dialect.emitSelect({
         from: 'users',
         where: { condition: 'age > $1', parameters: [18] }
       });
       expect(sql).toMatchSnapshot();
     });
     
     test('JOIN with multiple tables', () => {
       const sql = dialect.emitSelect({
         from: 'orders',
         joins: [
           { type: 'INNER', table: 'users', on: 'users.id = orders.userId' }
         ]
       });
       expect(sql).toMatchSnapshot();
     });
   });
   ```

2. **День 2: Property-Based Testing расширение**
   ```typescript
   // packages/query/tests/property-based/edge-cases.test.ts
   import fc from 'fast-check';
   
   describe('Predicate Parsing Edge Cases', () => {
     test('handles deep nested conditions', () => {
       fc.assert(
         fc.property(
           fc.integer({ min: 1, max: 5 }), // depth
           fc.array(fc.oneof(fc.constant('AND'), fc.constant('OR'))),
           (depth, operators) => {
             // Generate nested predicates and verify parsing
             const predicate = buildNestedPredicate(depth, operators);
             const result = parseToSQL(predicate);
             expect(result.parameters.length).toBeLessThanOrEqual(depth * 2);
           }
         )
       );
     });
   });
   ```

3. **День 3: Large Dataset Pagination Tests**
   ```typescript
   // packages/query/tests/integration/large-dataset.test.ts
   describe('Large Dataset Pagination', () => {
     beforeAll(async () => {
       // Insert 100,000 records
       await insertBulkData(100000);
     });
     
     test('paginate through 100k records without memory leak', async () => {
       const pageSize = 1000;
       let page = 0;
       let totalProcessed = 0;
       
       while (true) {
         const results = await ctx.users
           .orderBy(u => u.id)
           .skip(page * pageSize)
           .take(pageSize)
           .toArray();
         
         if (results.length === 0) break;
         totalProcessed += results.length;
         page++;
       }
       
       expect(totalProcessed).toBe(100000);
       // Check memory didn't grow significantly
       expect(process.memoryUsage().heapUsed).toBeLessThan(500 * 1024 * 1024);
     });
   });
   ```

4. **День 4: Concurrency Stress Tests**
   ```typescript
   // packages/core/tests/stress/concurrency.test.ts
   describe('Concurrency Stress Tests', () => {
     test('handles 100 concurrent reads without deadlock', async () => {
       const promises = Array.from({ length: 100 }, (_, i) => 
         ctx.users.where(u => u.id === i % 10).toArray()
       );
       
       const results = await Promise.all(promises);
       expect(results).toHaveLength(100);
     });
     
     test('handles concurrent writes with optimistic concurrency', async () => {
       const user = await ctx.users.find(1);
       
       const updates = Array.from({ length: 10 }, () => 
         ctx.users.update({ ...user, name: `Updated ${Date.now()}` })
       );
       
       // Only one should succeed, others should throw OptimisticConcurrencyError
       const results = await Promise.allSettled(updates);
       const successes = results.filter(r => r.status === 'fulfilled');
       expect(successes).toHaveLength(1);
     });
   });
   ```

**Критерий завершения**: Coverage >95%, все edge cases покрыты

---

### 1.2 Configuration Management System (P0) - 3 дня

**Задача**: Реализовать ts-linq.config.ts с валидацией

**Шаги**:

1. **День 1: Создать конфигурационную систему**
   ```typescript
   // packages/config/src/OrmConfig.ts
   export interface OrmConfig {
     provider: 'postgresql' | 'mysql' | 'sqlite' | 'mssql';
     connection: string | ConnectionOptions;
     migrations?: {
       directory?: string;
       tableName?: string;
       transactional?: boolean;
     };
     entities?: string | string[];
     cli?: {
       migrationsDir?: string;
       entitiesDir?: string;
       seedsDir?: string;
     };
     logging?: {
       level?: 'debug' | 'info' | 'warn' | 'error';
       sql?: boolean;
       slowQueryThreshold?: number;
     };
     performance?: {
       caching?: boolean;
       batchSize?: number;
       connectionPool?: ConnectionPoolOptions;
     };
   }
   
   export function defineConfig(config: OrmConfig): OrmConfig {
     return config;
   }
   ```

2. **День 2: Loader с поддержкой TypeScript**
   ```typescript
   // packages/config/src/ConfigLoader.ts
   import { pathToFileURL } from 'url';
   import { register } from 'ts-node';
   
   export class ConfigLoader {
     async load(configPath?: string): Promise<OrmConfig> {
       const path = configPath || this.findConfigFile();
       if (!path) {
         throw new Error('ts-linq.config.ts not found');
       }
       
       // Register ts-node for TypeScript configs
       register({ transpileOnly: true });
       
       // Dynamic import с поддержкой ESM
       const fileUrl = pathToFileURL(path).href;
       const module = await import(fileUrl);
       
       return this.validateConfig(module.default || module);
     }
     
     private findConfigFile(): string | null {
       const candidates = [
         'ts-linq.config.ts',
         'ts-linq.config.js',
         '.ts-linq.config.ts',
       ];
       
       for (const candidate of candidates) {
         if (fs.existsSync(candidate)) return candidate;
       }
       return null;
     }
     
     private validateConfig(config: unknown): OrmConfig {
       // Zod validation
       return OrmConfigSchema.parse(config);
     }
   }
   ```

3. **День 3: Интеграция с CLI**
   ```typescript
   // packages/cli/src/ConfigAwareCommand.ts
   export abstract class ConfigAwareCommand extends Command {
     protected config?: OrmConfig;
     
     async execute(args: string[]): Promise<void> {
       const configLoader = new ConfigLoader();
       this.config = await configLoader.load();
       
       await this.executeWithConfig(args, this.config);
     }
     
     abstract executeWithConfig(args: string[], config: OrmConfig): Promise<void>;
   }
   
   // Обновить все команды для использования конфига
   export class MigrateCommand extends ConfigAwareCommand {
     async executeWithConfig(args: string[], config: OrmConfig): Promise<void> {
       const migrationsDir = config.migrations?.directory || './migrations';
       // Use config...
     }
   }
   ```

**Критерий завершения**: Все CLI команды используют config, есть валидация

---

### 1.3 Gitleaks Integration (P0) - 1 день

**Задача**: Защита от утечки секретов в репозиторий

**Шаги**:

1. **Создать Gitleaks workflow**
   ```yaml
   # .github/workflows/gitleaks.yml
   name: Gitleaks
   
   on:
     push:
       branches: [main, develop]
     pull_request:
   
   jobs:
     scan:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
           with:
             fetch-depth: 0
         
         - name: Run Gitleaks
           uses: gitleaks/gitleaks-action@v2
           env:
             GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
             GITLEAKS_LICENSE: ${{ secrets.GITLEAKS_LICENSE }}
   ```

2. **Создать .gitleaksignore**
   ```
   # Ignore test fixtures with dummy secrets
   packages/*/tests/fixtures/**
   **/test-credentials.json
   ```

3. **Pre-commit hook**
   ```bash
   # .husky/pre-commit (добавить)
   npx gitleaks protect --staged --verbose
   ```

**Критерий завершения**: CI блокирует commits с секретами

---

### 1.4 Advanced Index Features (P1) - 2 дня

**Задача**: Завершить поддержку индексов

**Шаги**:

1. **День 1: Диалектные фичи индексов**
   ```typescript
   // packages/dialect-mysql/src/MySqlIndexSupport.ts
   export class MySqlIndexSupport {
     emitCreateIndex(index: IndexMetadata): string {
       let sql = `CREATE ${index.unique ? 'UNIQUE ' : ''}INDEX ${index.name}`;
       sql += ` ON ${index.tableName}`;
       
       // MySQL-specific: INDEX TYPE
       if (index.options?.type) {
         sql += ` USING ${index.options.type}`; // BTREE, HASH, FULLTEXT
       }
       
       // Column list with length prefix
       const cols = index.columns.map(col => {
         if (col.length) {
           return `${col.name}(${col.length})`; // For VARCHAR indexes
         }
         return col.name;
       });
       sql += ` (${cols.join(', ')})`;
       
       // MySQL doesn't support WHERE, use warnings
       if (index.where) {
         console.warn('MySQL does not support partial indexes (WHERE clause)');
       }
       
       return sql;
     }
   }
   ```

2. **День 2: Covering indexes (INCLUDE)**
   ```typescript
   // packages/types/src/index.ts
   export interface IndexMetadata {
     name: string;
     columns: string[];
     unique?: boolean;
     where?: string; // Partial index condition
     include?: string[]; // PostgreSQL INCLUDE columns (covering index)
     type?: 'btree' | 'hash' | 'gin' | 'gist'; // Index method
   }
   
   // packages/dialect-postgres/src/PostgresIndexSupport.ts
   emitCreateIndex(index: IndexMetadata): string {
     let sql = `CREATE ${index.unique ? 'UNIQUE ' : ''}INDEX`;
     sql += ` ${index.name} ON ${index.tableName}`;
     sql += ` USING ${index.type || 'btree'}`;
     sql += ` (${index.columns.join(', ')})`;
     
     if (index.include && index.include.length > 0) {
       sql += ` INCLUDE (${index.include.join(', ')})`;
     }
     
     if (index.where) {
       sql += ` WHERE ${index.where}`;
     }
     
     return sql;
   }
   ```

**Критерий завершения**: Все диалектные фичи индексов работают

---

### 1.5 Documentation Overhaul (P0) - 5 дней

**Задача**: Создать полную документацию

**Структура**:

```
docs/
├── README.md                    # Overview
├── getting-started/
│   ├── installation.md
│   ├── quick-start.md
│   ├── configuration.md
│   └── first-migration.md
├── guides/
│   ├── entities.md
│   ├── relationships.md
│   ├── queries.md
│   ├── migrations.md
│   ├── transactions.md
│   ├── computed-columns.md      # ✅ Уже есть
│   ├── conditional-validation.md # ✅ Уже есть
│   ├── database-functions.md     # ✅ Уже есть
│   ├── advanced-indexes.md
│   ├── performance-tuning.md
│   └── testing.md
├── api/
│   ├── decorators.md
│   ├── dbcontext.md
│   ├── queryable.md
│   └── providers.md
├── providers/
│   ├── postgresql.md
│   ├── mysql.md
│   ├── sqlite.md
│   └── mssql.md
└── migrations/
    ├── from-typeorm.md
    ├── from-prisma.md
    └── from-sequelize.md
```

**План по дням**:

**День 1-2: Getting Started**
```markdown
# docs/getting-started/quick-start.md

## Installation

\`\`\`bash
npm install @ts-linq/core @ts-linq/provider-postgres
\`\`\`

## Define your first entity

\`\`\`typescript
import { Entity, PrimaryKey, Column } from '@ts-linq/core';

@Entity()
export class User {
  @PrimaryKey()
  id!: number;

  @Column()
  name!: string;

  @Column()
  email!: string;
}
\`\`\`

## Create DbContext

\`\`\`typescript
import { DbContext, DbSet } from '@ts-linq/orm';
import { PostgresProvider } from '@ts-linq/provider-postgres';

export class AppDbContext extends DbContext {
  users!: DbSet<User>;

  constructor() {
    super({
      provider: new PostgresProvider(process.env.DATABASE_URL!)
    });
  }
}
\`\`\`

## Query data

\`\`\`typescript
const ctx = new AppDbContext();

// Simple query
const users = await ctx.users.toArray();

// With filtering
const adults = await ctx.users
  .where(u => u.age >= 18)
  .toArray();

// With includes
const usersWithOrders = await ctx.users
  .include(u => u.orders)
  .toArray();
\`\`\`
```

**День 3: API Reference**  
- Сгенерировать с TypeDoc + ручные примеры для каждого метода

**День 4: Миграционные гайды**
```markdown
# docs/migrations/from-typeorm.md

## Migrating from TypeORM

### Entity Definitions

**TypeORM**:
\`\`\`typescript
@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;
}
\`\`\`

**ts-linq**:
\`\`\`typescript
@Entity()
export class User {
  @PrimaryKey({ autoIncrement: true })
  id!: number;

  @Column()
  name!: string;
}
\`\`\`

### Queries

**TypeORM**:
\`\`\`typescript
const users = await repository.find({ where: { age: MoreThan(18) } });
\`\`\`

**ts-linq**:
\`\`\`typescript
const users = await ctx.users.where(u => u.age > 18).toArray();
\`\`\`

### See full comparison table...
```

**День 5: Performance & Production guides**

**Критерий завершения**: Документация покрывает 100% функционала

---

## PHASE 2: Advanced Features (4-5 недель)

### 2.1 Soft Delete Enhancement (P1) - 3 дня

**Текущий статус**: Базовая поддержка есть  
**Задача**: Расширить функционал

**Шаги**:

1. **День 1: Restore функциональность**
   ```typescript
   // packages/orm/src/DbSet.ts
   export class DbSet<T> {
     /**
      * Restore soft-deleted entities
      */
     async restore(predicate: (entity: T) => boolean): Promise<number> {
       if (!this._softDelete?.enabled) {
         throw new Error('Soft delete not enabled for this entity');
       }
       
       const entities = await this
         .withDeleted() // Include deleted
         .where(predicate)
         .toArray();
       
       const deletedField = this._softDelete.deletedAtColumn;
       let restored = 0;
       
       for (const entity of entities) {
         if (entity[deletedField]) {
           entity[deletedField] = null;
           this._changeTracker.update(entity);
           restored++;
         }
       }
       
       if (restored > 0) {
         await this._provider.saveChanges(this._changeTracker);
       }
       
       return restored;
     }
   }
   ```

2. **День 2: Cascade soft delete**
   ```typescript
   // packages/core/src/types/index.ts
   export interface SoftDeleteOptions {
     enabled: boolean;
     deletedAtColumn: string;
     cascade?: boolean; // NEW
   }
   
   // packages/orm/src/DbSet.ts
   async softDelete(entity: T): Promise<void> {
     // Set deletedAt
     entity[this._softDelete.deletedAtColumn] = new Date();
     
     if (this._softDelete.cascade) {
       // Find and soft-delete related entities
       const metadata = MetadataStorage.getEntity(this._entityClass);
       for (const rel of metadata.relationships || []) {
         if (rel.cascade) {
           const related = await this.loadRelated(entity, rel.propertyName);
           if (Array.isArray(related)) {
             for (const r of related) {
               await this.softDeleteRelated(r, rel);
             }
           }
         }
       }
     }
   }
   ```

3. **День 3: Интеграция с миграциями**
   ```typescript
   // packages/migrations/src/DiffGenerator.ts
   detectSoftDeleteChanges(oldEntity: EntityMetadata, newEntity: EntityMetadata) {
     const oldSD = oldEntity.softDelete;
     const newSD = newEntity.softDelete;
     
     if (!oldSD && newSD) {
       // Add soft delete column
       return {
         type: 'add-column',
         table: newEntity.tableName,
         column: {
           name: newSD.deletedAtColumn,
           type: 'timestamp',
           nullable: true
         }
       };
     }
     
     if (oldSD && !newSD) {
       // Remove soft delete (convert to hard delete)
       return {
         type: 'remove-column',
         table: oldEntity.tableName,
         column: oldSD.deletedAtColumn
       };
     }
   }
   ```

**Критерий завершения**: Полная поддержка soft delete с cascade и restore

---

### 2.2 Multi-Tenancy Support (P1) - 5 дней

**Задача**: Полноценная поддержка multi-tenancy

**Архитектура**:

```typescript
// packages/plugin-multi-tenant/src/TenantStrategy.ts
export interface TenantStrategy {
  getCurrentTenantId(): string | null;
  applyTenantFilter<T>(query: Queryable<T>): Queryable<T>;
}

// Row-level strategy (recommended)
export class RowLevelTenantStrategy implements TenantStrategy {
  constructor(
    private tenantColumn: string = 'tenantId',
    private getCurrentTenant: () => string
  ) {}
  
  getCurrentTenantId(): string {
    return this.getCurrentTenant();
  }
  
  applyTenantFilter<T>(query: Queryable<T>): Queryable<T> {
    const tenantId = this.getCurrentTenantId();
    return query.where((entity: any) => entity[this.tenantColumn] === tenantId);
  }
}

// Schema-level strategy
export class SchemaLevelTenantStrategy implements TenantStrategy {
  constructor(private getCurrentSchema: () => string) {}
  
  getCurrentTenantId(): string {
    return this.getCurrentSchema();
  }
  
  applyTenantFilter<T>(query: Queryable<T>): Queryable<T> {
    // Change schema before query
    const schema = this.getCurrentSchema();
    // Implementation depends on provider
    return query;
  }
}
```

**План**:

**День 1**: Tenant-aware DbContext
```typescript
// packages/plugin-multi-tenant/src/MultiTenantDbContext.ts
export abstract class MultiTenantDbContext extends DbContext {
  private tenantStrategy: TenantStrategy;
  
  constructor(options: DbContextOptions, strategy: TenantStrategy) {
    super(options);
    this.tenantStrategy = strategy;
  }
  
  protected override createDbSet<T>(entityClass: new () => T): DbSet<T> {
    const baseSet = super.createDbSet(entityClass);
    
    // Wrap all queries with tenant filter
    return new Proxy(baseSet, {
      get: (target, prop) => {
        if (prop === 'where' || prop === 'toArray' || prop === 'find') {
          return (...args: any[]) => {
            let query = target[prop](...args);
            return this.tenantStrategy.applyTenantFilter(query);
          };
        }
        return target[prop];
      }
    });
  }
}
```

**День 2**: Tenant isolation middleware
```typescript
export class TenantIsolationMiddleware implements OrmMiddleware {
  async beforeExecute(sql: string, params: SqlParameter[]): Promise<void> {
    // Verify query doesn't cross tenant boundaries
    if (sql.toLowerCase().includes('cross join') ||
        sql.toLowerCase().includes('union')) {
      // Validate tenant isolation
      this.validateTenantIsolation(sql);
    }
  }
}
```

**День 3-4**: Database per tenant support
```typescript
export class DatabasePerTenantStrategy implements TenantStrategy {
  private providers = new Map<string, DatabaseProvider>();
  
  async getProviderForTenant(tenantId: string): Promise<DatabaseProvider> {
    if (!this.providers.has(tenantId)) {
      const connectionString = await this.getTenantConnection(tenantId);
      this.providers.set(tenantId, new PostgresProvider(connectionString));
    }
    return this.providers.get(tenantId)!;
  }
}
```

**День 5**: Тесты и документация

**Критерий завершения**: 3 стратегии multi-tenancy работают

---

### 2.3 Advanced Caching Layer (P1) - 4 дня

**Задача**: L2 cache с инвалидацией

**Архитектура**:

```typescript
// packages/cache/src/L2Cache.ts
export interface CacheKey {
  entity: string;
  predicate: string;
  params: readonly SqlParameter[];
}

export class L2EntityCache implements EntityCacheLike {
  private cache = new Map<string, CachedEntity>();
  private maxSize: number;
  private ttl: number;
  
  // Tag-based invalidation
  private tags = new Map<string, Set<string>>(); // tag -> cache keys
  
  set(key: string, value: any, tags?: string[]): void {
    this.evictIfNeeded();
    
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      tags: tags || []
    });
    
    // Register tags
    if (tags) {
      for (const tag of tags) {
        if (!this.tags.has(tag)) {
          this.tags.set(tag, new Set());
        }
        this.tags.get(tag)!.add(key);
      }
    }
  }
  
  invalidateByTag(tag: string): void {
    const keys = this.tags.get(tag);
    if (keys) {
      for (const key of keys) {
        this.cache.delete(key);
      }
      this.tags.delete(tag);
    }
  }
  
  invalidateByEntity(entityName: string): void {
    this.invalidateByTag(`entity:${entityName}`);
  }
}
```

**План**:

**День 1**: Query result caching
```typescript
export class QueryResultCache {
  async getOrCompute<T>(
    key: CacheKey,
    compute: () => Promise<T[]>
  ): Promise<T[]> {
    const cacheKey = this.generateKey(key);
    const cached = this.cache.get(cacheKey);
    
    if (cached && !this.isExpired(cached)) {
      return cached.value;
    }
    
    const result = await compute();
    this.cache.set(cacheKey, result, [
      `entity:${key.entity}`,
      `query:${this.hashQuery(key.predicate)}`
    ]);
    
    return result;
  }
}
```

**День 2**: Write-through cache
```typescript
export class WriteThroughCache extends L2EntityCache {
  async saveChanges(changes: TrackedEntity[]): Promise<void> {
    // Invalidate affected entities
    for (const change of changes) {
      const entityName = change.entityClass.name;
      this.invalidateByEntity(entityName);
    }
    
    // Persist to database
    await this.provider.saveChanges(changes);
    
    // Optionally warm cache with new values
    for (const change of changes) {
      if (change.state === 'Modified' || change.state === 'Added') {
        const pk = this.getPrimaryKey(change.entity);
        this.set(pk, change.entity, [`entity:${entityName}`]);
      }
    }
  }
}
```

**День 3**: Distributed cache support (Redis)
```typescript
// packages/cache-redis/src/DistributedL2Cache.ts
export class DistributedL2Cache extends L2EntityCache {
  constructor(private redis: RedisClient) {
    super();
  }
  
  async get(key: string): Promise<any> {
    const cached = await this.redis.get(key);
    if (!cached) return undefined;
    
    return JSON.parse(cached);
  }
  
  async set(key: string, value: any, tags?: string[]): Promise<void> {
    await this.redis.set(key, JSON.stringify(value), 'EX', this.ttl);
    
    // Store tags for invalidation
    if (tags) {
      for (const tag of tags) {
        await this.redis.sadd(`tag:${tag}`, key);
      }
    }
  }
  
  async invalidateByTag(tag: string): Promise<void> {
    const keys = await this.redis.smembers(`tag:${tag}`);
    if (keys.length > 0) {
      await this.redis.del(...keys);
      await this.redis.del(`tag:${tag}`);
    }
  }
}
```

**День 4**: Тесты и бенчмарки

**Критерий завершения**: Кеш даёт 10x ускорение на read-heavy workloads

---

### 2.4 Query Optimization & Explain (P2) - 3 дня

**Задача**: Automatic query optimization

**План**:

**День 1**: Query analyzer
```typescript
// packages/query/src/QueryAnalyzer.ts
export class QueryAnalyzer {
  analyzeQuery(query: Queryable<any>): QueryAnalysis {
    const analysis: QueryAnalysis = {
      warnings: [],
      suggestions: [],
      estimatedRows: 0
    };
    
    // Check for N+1 queries
    if (this.hasNestedIncludes(query) && !query.hasBatchLoading()) {
      analysis.warnings.push({
        type: 'N+1',
        message: 'Consider using batch loading for includes',
        fix: 'Use .withBatchSize(100)'
      });
    }
    
    // Check for missing indexes
    const whereColumns = this.extractWhereColumns(query);
    for (const col of whereColumns) {
      if (!this.hasIndex(col)) {
        analysis.suggestions.push({
          type: 'index',
          message: `Consider adding index on ${col}`,
          impact: 'high'
        });
      }
    }
    
    return analysis;
  }
}
```

**День 2**: EXPLAIN integration
```typescript
export class QueryExplainer {
  async explain<T>(query: Queryable<T>): Promise<ExplainResult> {
    const sql = query.toSQL();
    
    // Get execution plan from database
    const plan = await this.provider.execute(
      `EXPLAIN (FORMAT JSON, ANALYZE) ${sql}`,
      query.getParameters()
    );
    
    return this.parseExplainResult(plan);
  }
  
  private parseExplainResult(raw: any): ExplainResult {
    // Parse provider-specific EXPLAIN output
    return {
      totalCost: raw.cost,
      rows: raw.rows,
      operations: this.extractOperations(raw),
      indexesUsed: this.extractIndexes(raw),
      warnings: this.detectSlowOperations(raw)
    };
  }
}
```

**День 3**: Auto-optimization hints
```typescript
export class AutoOptimizer {
  optimize<T>(query: Queryable<T>): Queryable<T> {
    let optimized = query;
    
    // Add limit if none specified (prevent full table scans)
    if (!query.hasLimit() && !query.hasCount()) {
      optimized = optimized.take(1000);
    }
    
    // Convert multiple includes to batch loading
    if (this.countIncludes(query) > 2) {
      optimized = optimized.withBatchSize(100);
    }
    
    // Use covering index if available
    const coveringIndex = this.findCoveringIndex(query);
    if (coveringIndex) {
      optimized = optimized.useIndex(coveringIndex);
    }
    
    return optimized;
  }
}
```

**Критерий завершения**: Auto-optimizer работает, есть EXPLAIN UI

---

## PHASE 3: Developer Experience (3-4 недели)

### 3.1 VS Code Extension (P2) - 1 неделя

**Задача**: Полноценное расширение для VS Code

**Функции**:

1. **Entity scaffolding**
   - Snippet для создания entity
   - Auto-completion для decorators
   - Validation декораторов

2. **Query builder IntelliSense**
   - Auto-complete для методов Queryable
   - Type hints для predicates
   - Inline EXPLAIN для запросов

3. **Migration helper**
   - Show pending migrations в статус-баре
   - Quick action "Run migrations"
   - Diff preview в editor

**Структура**:
```
packages/vscode-extension/
├── package.json
├── src/
│   ├── extension.ts           # Entry point
│   ├── providers/
│   │   ├── CompletionProvider.ts
│   │   ├── HoverProvider.ts
│   │   └── CodeActionProvider.ts
│   ├── commands/
│   │   ├── GenerateEntity.ts
│   │   ├── RunMigrations.ts
│   │   └── ExplainQuery.ts
│   └── diagnostics/
│       └── EntityValidator.ts
└── syntaxes/
    └── ts-linq.json
```

**Критерий завершения**: Опубликовано в Marketplace

---

### 3.2 GraphQL Integration (P2) - 1 неделя

**Задача**: Автоматическая генерация GraphQL схемы

```typescript
// packages/graphql/src/SchemaGenerator.ts
export class GraphQLSchemaGenerator {
  generateSchema(entities: Function[]): GraphQLSchema {
    const types = entities.map(this.entityToGraphQLType);
    const queries = entities.map(this.generateQueries);
    const mutations = entities.map(this.generateMutations);
    
    return new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: Object.assign({}, ...queries)
      }),
      mutation: new GraphQLObjectType({
        name: 'Mutation',
        fields: Object.assign({}, ...mutations)
      })
    });
  }
  
  private entityToGraphQLType(entity: Function): GraphQLObjectType {
    const metadata = MetadataStorage.getEntity(entity);
    
    return new GraphQLObjectType({
      name: entity.name,
      fields: () => {
        const fields: any = {};
        
        for (const col of metadata.columns) {
          fields[col.propertyName] = {
            type: this.mapTypeToGraphQL(col.type),
            description: col.description
          };
        }
        
        // Add relationships
        for (const rel of metadata.relationships || []) {
          fields[rel.propertyName] = {
            type: rel.isArray ? 
              new GraphQLList(this.entityToGraphQLType(rel.target)) :
              this.entityToGraphQLType(rel.target),
            resolve: (parent: any, args: any, context: any) => {
              return context.db[rel.propertyName]
                .where(e => e[rel.foreignKey] === parent.id)
                .toArray();
            }
          };
        }
        
        return fields;
      }
    });
  }
}

// Usage
const schema = new GraphQLSchemaGenerator().generateSchema([User, Order, Product]);
const server = new ApolloServer({ schema });
```

**Критерий завершения**: Apollo integration работает out-of-the-box

---

### 3.3 Admin UI Generator (P3) - 2 недели

**Задача**: Auto-generated admin panel

**Технологии**: React + TanStack Table + React Hook Form

```typescript
// packages/admin-ui/src/AdminPanel.tsx
export function AdminPanel<T>({ 
  entity,
  dbContext,
  customizations 
}: AdminPanelProps<T>) {
  const metadata = MetadataStorage.getEntity(entity);
  
  return (
    <AdminLayout>
      <DataTable
        columns={generateColumns(metadata)}
        data={useEntityData(dbContext, entity)}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />
    </AdminLayout>
  );
}

// Auto-generate forms
function generateForm(metadata: EntityMetadata) {
  return metadata.columns.map(col => {
    switch (col.type) {
      case 'string':
        return <TextInput name={col.propertyName} label={col.name} />;
      case 'number':
        return <NumberInput name={col.propertyName} label={col.name} />;
      case 'date':
        return <DatePicker name={col.propertyName} label={col.name} />;
      // etc.
    }
  });
}
```

**Критерий завершения**: Working demo с CRUD на всех entity

---

## PHASE 4: Enterprise Features (5-6 недель)

### 4.1 Row-Level Security (P1) - 1 неделя

```typescript
// packages/security/src/RLS.ts
export class RowLevelSecurity {
  private policies = new Map<string, SecurityPolicy[]>();
  
  definePolicy<T>(
    entity: new () => T,
    name: string,
    check: (user: User, row: T) => boolean
  ): void {
    const entityName = entity.name;
    if (!this.policies.has(entityName)) {
      this.policies.set(entityName, []);
    }
    
    this.policies.get(entityName)!.push({ name, check });
  }
  
  applyPolicies<T>(
    query: Queryable<T>,
    user: User
  ): Queryable<T> {
    const policies = this.policies.get(query.entityType.name) || [];
    
    let filtered = query;
    for (const policy of policies) {
      filtered = filtered.where(row => policy.check(user, row));
    }
    
    return filtered;
  }
}

// Usage
const rls = new RowLevelSecurity();

rls.definePolicy(User, 'owner_only', (user, row) => {
  return row.userId === user.id || user.isAdmin;
});

rls.definePolicy(Document, 'team_access', (user, row) => {
  return row.teamId === user.teamId;
});
```

---

### 4.2 Audit Trail (P1) - 1 неделя

**Расширить существующий audit plugin**:

```typescript
// packages/plugin-audit/src/AuditTrail.ts
export class AuditTrailMiddleware implements OrmMiddleware {
  async afterExecute(
    sql: string,
    params: SqlParameter[],
    result: any,
    context: ExecutionContext
  ): Promise<void> {
    if (this.isModifyingQuery(sql)) {
      await this.logAudit({
        user: context.user,
        action: this.detectAction(sql),
        entity: context.entity,
        before: context.originalValues,
        after: result,
        timestamp: new Date(),
        metadata: {
          ip: context.request.ip,
          userAgent: context.request.headers['user-agent']
        }
      });
    }
  }
  
  private async logAudit(entry: AuditEntry): Promise<void> {
    // Write to audit_log table
    await this.auditDb.auditLogs.add({
      ...entry,
      changes: this.diffObjects(entry.before, entry.after)
    });
  }
}
```

---

### 4.3 Data Encryption at Rest (P1) - 1 неделя

```typescript
// packages/security/src/Encryption.ts
export class FieldEncryption {
  constructor(private key: Buffer) {}
  
  @Encrypt()
  encrypt(value: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
    
    let encrypted = cipher.update(value, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }
  
  decrypt(encrypted: string): string {
    const [ivHex, authTagHex, data] = encrypted.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}

// Usage
@Entity()
class User {
  @PrimaryKey()
  id!: number;
  
  @Column()
  @Encrypted() // Auto encrypt/decrypt
  ssn!: string;
  
  @Column()
  @Encrypted()
  creditCard!: string;
}
```

---

### 4.4 Database Sharding (P2) - 2 недели

```typescript
// packages/sharding/src/ShardingStrategy.ts
export interface ShardingStrategy {
  getShard(key: any): string;
}

export class HashSharding implements ShardingStrategy {
  constructor(
    private shards: string[],
    private hashFunction: (key: any) => number = defaultHash
  ) {}
  
  getShard(key: any): string {
    const hash = this.hashFunction(key);
    const index = hash % this.shards.length;
    return this.shards[index];
  }
}

export class ShardedDbContext extends DbContext {
  private shardProviders = new Map<string, DatabaseProvider>();
  
  constructor(
    private sharding: ShardingStrategy,
    shardConnections: Map<string, string>
  ) {
    // Initialize providers for each shard
    for (const [shard, connection] of shardConnections) {
      this.shardProviders.set(shard, new PostgresProvider(connection));
    }
  }
  
  async find<T>(entityClass: new () => T, key: any): Promise<T | null> {
    const shard = this.sharding.getShard(key);
    const provider = this.shardProviders.get(shard)!;
    
    return provider.find(entityClass, key);
  }
  
  async scatter<T>(
    entityClass: new () => T,
    operation: (ctx: DbContext) => Promise<T[]>
  ): Promise<T[]> {
    // Execute on all shards and merge results
    const results = await Promise.all(
      Array.from(this.shardProviders.values()).map(provider =>
        operation(new DbContext({ provider }))
      )
    );
    
    return results.flat();
  }
}
```

---

## PHASE 5: Performance & Scale (4-5 недель)

### 5.1 Connection Pooling Enhancement (P0) - 1 неделя

**Улучшить существующий pooling**:

```typescript
// packages/core/src/ConnectionPool.ts
export class EnhancedConnectionPool {
  private pool: GenericPool<Connection>;
  private metrics: PoolMetrics;
  
  constructor(options: ConnectionPoolOptions) {
    this.pool = createPool({
      create: () => this.createConnection(),
      destroy: (conn) => conn.close(),
      validate: (conn) => this.healthCheck(conn),
      min: options.minConnections || 2,
      max: options.maxConnections || 10,
      acquireTimeoutMillis: options.acquireTimeout || 30000,
      idleTimeoutMillis: options.idleTimeout || 30000,
      evictionRunIntervalMillis: 5000,
      testOnBorrow: true
    });
    
    this.startMetricsCollection();
  }
  
  private async healthCheck(conn: Connection): Promise<boolean> {
    try {
      await conn.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }
  
  private startMetricsCollection(): void {
    setInterval(() => {
      this.metrics = {
        size: this.pool.size,
        available: this.pool.available,
        borrowed: this.pool.borrowed,
        pending: this.pool.pending,
        min: this.pool.min,
        max: this.pool.max
      };
    }, 1000);
  }
  
  getMetrics(): PoolMetrics {
    return this.metrics;
  }
}
```

---

### 5.2 Query Compilation Cache (P1) - 3 дня

```typescript
// packages/query/src/QueryCompiler.ts
export class QueryCompiler {
  private cache = new LRUCache<string, CompiledQuery>(1000);
  
  compile<T>(query: Queryable<T>): CompiledQuery {
    const key = this.generateCacheKey(query);
    
    const cached = this.cache.get(key);
    if (cached) {
      return cached;
    }
    
    const compiled = {
      sql: this.buildSQL(query),
      parameterMapping: this.extractParameters(query),
      resultMapper: this.buildResultMapper(query)
    };
    
    this.cache.set(key, compiled);
    return compiled;
  }
  
  private generateCacheKey(query: Queryable<any>): string {
    // Generate stable key from query structure
    return hash({
      entity: query.entityType.name,
      where: query.getWhere(),
      select: query.getSelect(),
      orderBy: query.getOrderBy(),
      includes: query.getIncludes()
    });
  }
}
```

---

### 5.3 Bulk Operations Optimization (P1) - 4 дня

```typescript
// packages/core/src/BulkOperations.ts
export class BulkOperations {
  /**
   * Bulk insert with automatic batching
   */
  async bulkInsert<T>(
    entities: T[],
    options: BulkInsertOptions = {}
  ): Promise<void> {
    const batchSize = options.batchSize || 1000;
    
    for (let i = 0; i < entities.length; i += batchSize) {
      const batch = entities.slice(i, i + batchSize);
      
      // Use native bulk insert (COPY for Postgres, LOAD DATA for MySQL)
      if (this.provider.supportsBulkCopy()) {
        await this.provider.bulkCopy(batch);
      } else {
        // Fall back to batched INSERTs
        await this.batchInsert(batch);
      }
    }
  }
  
  /**
   * Bulk update with WHERE condition
   */
  async bulkUpdate<T>(
    predicate: (entity: T) => boolean,
    updates: Partial<T>,
    options: BulkUpdateOptions = {}
  ): Promise<number> {
    const sql = this.buildBulkUpdateSQL(predicate, updates);
    const result = await this.provider.execute(sql);
    return result.rowsAffected;
  }
  
  /**
   * Upsert (insert or update)
   */
  async upsert<T>(
    entities: T[],
    conflictColumns: (keyof T)[],
    updateColumns: (keyof T)[]
  ): Promise<void> {
    // Use provider-specific upsert
    // Postgres: ON CONFLICT ... DO UPDATE
    // MySQL: ON DUPLICATE KEY UPDATE
    // SQLite: ON CONFLICT ... DO UPDATE (3.24+)
    
    const sql = this.dialect.emitUpsert({
      table: this.tableName,
      values: entities,
      conflictColumns,
      updateColumns
    });
    
    await this.provider.execute(sql);
  }
}
```

---

### 5.4 Read Replicas Support (P1) - 1 неделя

```typescript
// packages/core/src/ReadReplicas.ts
export class ReadReplicaManager {
  private primary: DatabaseProvider;
  private replicas: DatabaseProvider[];
  private replicaSelector: ReplicaSelector;
  
  constructor(
    primary: string,
    replicas: string[],
    selector: ReplicaSelector = new RoundRobinSelector()
  ) {
    this.primary = new PostgresProvider(primary);
    this.replicas = replicas.map(r => new PostgresProvider(r));
    this.replicaSelector = selector;
  }
  
  async execute(sql: string, params: SqlParameter[]): Promise<any> {
    // Route reads to replicas, writes to primary
    if (this.isReadQuery(sql)) {
      const replica = this.replicaSelector.select(this.replicas);
      return replica.execute(sql, params);
    } else {
      return this.primary.execute(sql, params);
    }
  }
  
  private isReadQuery(sql: string): boolean {
    const normalized = sql.trim().toUpperCase();
    return normalized.startsWith('SELECT') ||
           normalized.startsWith('WITH');
  }
}

export class RoundRobinSelector implements ReplicaSelector {
  private index = 0;
  
  select(replicas: DatabaseProvider[]): DatabaseProvider {
    const replica = replicas[this.index];
    this.index = (this.index + 1) % replicas.length;
    return replica;
  }
}

export class LatencyBasedSelector implements ReplicaSelector {
  private latencies = new Map<DatabaseProvider, number>();
  
  async select(replicas: DatabaseProvider[]): Promise<DatabaseProvider> {
    // Measure latency and pick fastest
    await this.updateLatencies(replicas);
    
    let fastest = replicas[0];
    let minLatency = this.latencies.get(fastest) || Infinity;
    
    for (const replica of replicas) {
      const latency = this.latencies.get(replica) || Infinity;
      if (latency < minLatency) {
        minLatency = latency;
        fastest = replica;
      }
    }
    
    return fastest;
  }
}
```

---

## PRIORITY SUMMARY

### Immediate (Next 2 weeks)
1. ✅ Testing Coverage >95% (P0)
2. ✅ Configuration Management (P0)
3. ✅ Gitleaks Integration (P0)
4. ✅ Documentation Complete (P0)

### Short-term (1-2 months)
5. Advanced Index Features (P1)
6. Soft Delete Enhancement (P1)
7. Multi-Tenancy Support (P1)
8. L2 Cache Layer (P1)
9. Connection Pooling Enhancement (P0)

### Medium-term (2-4 months)
10. VS Code Extension (P2)
11. GraphQL Integration (P2)
12. Query Optimization (P2)
13. Row-Level Security (P1)
14. Audit Trail Enhancement (P1)
15. Bulk Operations (P1)

### Long-term (4-6 months)
16. Admin UI Generator (P3)
17. Database Sharding (P2)
18. Data Encryption (P1)
19. Read Replicas (P1)

---

## Метрики Успеха

### Performance
- [ ] 10x faster than TypeORM на read-heavy workloads
- [ ] <100ms latency на 95th percentile для queries
- [ ] Support 10k+ concurrent connections

### Quality
- [ ] >95% test coverage
- [ ] Zero critical bugs в production
- [ ] <1% regression rate per release

### Adoption
- [ ] 1k+ GitHub stars
- [ ] 100+ production users
- [ ] 10+ contributors

---

## Трекинг Прогресса

Создайте GitHub Projects board:
- **Backlog**: Все задачи из этого roadmap
- **In Progress**: Текущая работа (макс 3 задачи)
- **Review**: Code review + testing
- **Done**: Завершено и документировано

Еженедельно обновляйте прогресс в этом файле.

---

**Следующий шаг**: Начните с Phase 1.1 (Testing Coverage) - это foundation для всего остального.
