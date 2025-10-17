# Stage-3 Decorators Migration Plan

## Objective
Remove ALL legacy decorator support and reflect-metadata dependency while maintaining 100% functionality.

## Current State Analysis

### ✅ Already Done
- All decorators throw Error if not Stage-3 context
- Using `context.addInitializer()` for metadata registration
- Stage-3 compatible metadata storage

### ❌ Still Using Legacy Features
- `import 'reflect-metadata'` in 9 decorator files
- `experimentalDecorators: true` in tsconfig.json
- `emitDecoratorMetadata: true` in tsconfig.json  
- `Reflect.getMetadata('design:type')` for auto-type inference
- Dual storage: MetadataStorage + Reflect metadata

## Migration Strategy

### Phase 1: Remove reflect-metadata Dependency

#### 1.1 Replace `Reflect.getMetadata('design:type')`
**Problem:** Used to auto-infer column types from TypeScript types

**Solutions:**
```typescript
// BEFORE (with reflect-metadata):
const designType = Reflect.getMetadata('design:type', prototype, propertyName);
const type = options.type || getTypeString(designType);

// AFTER (explicit types required):
const type = options.type || 'TEXT'; // Default to TEXT, explicit type required for non-text
```

**Action Items:**
- [ ] Update @Column to require explicit `type` for non-TEXT columns
- [ ] Update CLI entity generator to always include explicit types
- [ ] Create migration guide for users to add explicit types
- [ ] Add runtime validation warning when type not provided

#### 1.2 Remove Dual Storage
**Problem:** Metadata stored in both MetadataStorage AND Reflect metadata

**Solution:**
- Use ONLY MetadataStorage as single source of truth
- Remove all `Reflect.defineMetadata()` calls
- Remove all `Reflect.getOwnMetadata()` calls
- Keep `context.addInitializer()` → `MetadataStorage.add*()` flow

**Action Items:**
- [ ] Remove all Reflect.defineMetadata calls from decorators
- [ ] Remove all Reflect.getOwnMetadata calls from Entity decorator
- [ ] Remove sync logic in Entity decorator that reads Reflect metadata
- [ ] Verify MetadataStorage handles all metadata correctly

#### 1.3 Remove reflect-metadata Import
**Action Items:**
- [ ] Remove `import 'reflect-metadata'` from all decorator files
- [ ] Remove `reflect-metadata` from package.json dependencies
- [ ] Verify no other code depends on reflect-metadata

### Phase 2: Update TypeScript Configuration

#### 2.1 Remove Legacy Decorator Config
**Action Items:**
- [ ] Set `experimentalDecorators: false` (or remove, defaults to false)
- [ ] Set `emitDecoratorMetadata: false` (or remove, defaults to false)
- [ ] Update all package tsconfig.json files
- [ ] Remove tsconfig.stage3.json (merge into main tsconfig)

#### 2.2 Update Build Scripts
**Action Items:**
- [ ] Verify all builds work without experimental decorators
- [ ] Update rollup config if needed
- [ ] Test dual build (CJS + ESM) with Stage-3 only

### Phase 3: Update CLI & Code Generation

#### 3.1 Entity Generator Templates
**Current template likely generates:**
```typescript
@Entity()
class User {
  @Column()  // Auto-infers type from TypeScript
  name!: string;
}
```

**New template must generate:**
```typescript
@Entity()
class User {
  @Column({ type: 'TEXT' })  // Explicit type required
  name!: string;
}
```

**Action Items:**
- [ ] Update EntityTemplateBuilder to include explicit types
- [ ] Add type mapping: string→TEXT, number→INTEGER, boolean→BOOLEAN, Date→DATETIME
- [ ] Update all examples in docs
- [ ] Update CLI init command templates

#### 3.2 Reverse Engineering (generate:entity --from-table)
**Action Items:**
- [ ] Ensure generated entities have explicit types from DB schema
- [ ] Test with all providers (PG, MySQL, MSSQL, SQLite)

### Phase 4: Test Migration

#### 4.1 Update All Tests
**Action Items:**
- [ ] Update test entities to use explicit types
- [ ] Remove any reflect-metadata mocks/setup
- [ ] Verify all decorator tests pass
- [ ] Add tests for explicit type requirement

#### 4.2 Property-Based Testing
**Action Items:**
- [ ] Update fast-check generators for entities with explicit types
- [ ] Test metadata registration without reflect-metadata

### Phase 5: Documentation

#### 5.1 Migration Guide
**Content:**
- Breaking changes summary
- How to add explicit types to existing entities
- Codemod script (if possible)
- Before/after examples

#### 5.2 API Documentation
**Action Items:**
- [ ] Update decorator documentation
- [ ] Add "Breaking Changes" section to CHANGELOG
- [ ] Update examples in README
- [ ] Update guides in docs/

## Implementation Checklist

### Pre-Migration Verification
- [ ] Run full test suite - baseline results
- [ ] Document all current reflect-metadata usage
- [ ] Create backup branch

### Decorator Files to Update
- [ ] packages/core/src/decorators/Entity.ts
- [ ] packages/core/src/decorators/Column.ts  
- [ ] packages/core/src/decorators/PrimaryKey.ts
- [ ] packages/core/src/decorators/ComputedColumn.ts
- [ ] packages/core/src/decorators/DatabaseFunction.ts
- [ ] packages/core/src/decorators/Relationships.ts
- [ ] packages/core/src/decorators/ValidIf.ts
- [ ] packages/core/src/decorators/CachePolicy.ts
- [ ] packages/core/src/decorators/Index.ts (if exists)

### Configuration Files to Update
- [ ] tsconfig.json (root)
- [ ] packages/core/tsconfig.json
- [ ] packages/*/tsconfig.json (all packages)
- [ ] Remove tsconfig.stage3.json

### CLI Files to Update
- [ ] packages/cli/src/generators/EntityTemplateBuilder.ts
- [ ] packages/cli/src/commands/GenerateEntityCommand.ts
- [ ] packages/cli/src/commands/InitCommand.ts

### Test Files to Update
- [ ] All test entities in packages/*/tests/
- [ ] Decorator unit tests
- [ ] Integration tests with testcontainers
- [ ] Property-based tests

### Dependencies
- [ ] Remove reflect-metadata from package.json
- [ ] Run `pnpm install` to update lock file
- [ ] Verify bundle size reduction

## Validation Criteria

### ✅ Success Metrics
- [ ] Zero usage of reflect-metadata in codebase
- [ ] experimentalDecorators: false in all tsconfig files
- [ ] All tests pass (unit + integration + e2e)
- [ ] Bundle size reduced (no reflect-metadata)
- [ ] CLI generates correct entity code
- [ ] No runtime errors with Stage-3 decorators
- [ ] Documentation updated

### ⚠️ Breaking Changes
- `@Column()` without explicit `type` defaults to 'TEXT' instead of auto-inferring
- Users must update entities to include explicit types
- Migration guide provided

## Timeline
- Phase 1-2: 1 week (core decorator migration)
- Phase 3: 2-3 days (CLI updates)
- Phase 4: 1 week (test updates)
- Phase 5: 2-3 days (documentation)

**Total Estimated Time:** 2-3 weeks

## Risk Mitigation
- Create feature branch for migration
- Incremental testing after each phase
- Keep old tests running until migration complete
- Provide comprehensive migration guide
- Version bump to 2.0.0 (breaking changes)
