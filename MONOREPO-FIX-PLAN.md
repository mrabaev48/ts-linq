# 🔧 Monorepo Build Fix Plan

## Current Status

❌ Build failing due to:
1. Circular dependencies in core/re-exports.ts (FIXED - moved to .bak)
2. TypeScript path resolution issues in ast package
3. Missing build orchestration

## Immediate Actions (Priority Order)

### Phase 1: Fix TypeScript Configurations ✅

**1.1 Foundation Packages (No dependencies)**
```bash
✅ packages/types - BUILT successfully
✅ packages/metrics-safe - BUILT successfully
❌ packages/ast - Needs tsconfig fix
```

**Problem in ast/tsconfig.json:**
- paths point to `../types/src` instead of `../types/dist`
- rootDir constraint prevents using source imports

**Solution:**
```json
{
  "paths": {
    "@ts-linq/types": ["../types/dist"]
  }
}
```

### Phase 2: Build Core Dependencies

After fixing ast:
```bash
cd packages/metadata && npm run build
cd packages/query && npm run build  
cd packages/orm && npm run build
cd packages/migrations && npm run build
cd packages/concurrency && npm run build
cd packages/pagination && npm run build
cd packages/cache && npm run build
```

### Phase 3: Build Dialects & Providers

```bash
cd packages/dialect-postgres && npm run build
cd packages/dialect-mysql && npm run build
cd packages/dialect-mssql && npm run build
cd packages/dialect-sqlite && npm run build

cd packages/provider-postgres && npm run build
cd packages/provider-mysql && npm run build
cd packages/provider-mssql && npm run build
cd packages/provider-sqlite && npm run build
```

### Phase 4: Build Extensions

```bash
cd packages/cache-redis && npm run build
cd packages/cache-memcached && npm run build
cd packages/plugin-* && npm run build
cd packages/telemetry && npm run build
```

### Phase 5: Build Tools

```bash
cd packages/cli && npm run build
cd packages/testkits && npm run build
cd packages/config && npm run build
```

## Build Dependencies Graph

```
types (no deps)
  ├─> ast
  └─> metrics-safe

metadata (needs: types)
query (needs: types, ast)
orm (needs: types, metadata, query)
migrations (needs: types, metadata, orm)
concurrency (needs: types)
pagination (needs: types)
cache (needs: types)

dialects (need: types)
providers (need: types, dialects, orm)

plugins (need: orm, metadata)
cli (need: core, providers, migrations)
testkits (need: core, providers)
```

## Script to Add to Root package.json

```json
{
  "scripts": {
    "build:foundation": "npm run build -w @ts-linq/types -w @ts-linq/metrics-safe -w @ts-linq/ast",
    "build:core": "npm run build -w @ts-linq/metadata -w @ts-linq/query -w @ts-linq/orm -w @ts-linq/migrations",
    "build:providers": "npm run build -w @ts-linq/dialect-* -w @ts-linq/provider-*",
    "build:extensions": "npm run build -w @ts-linq/cache* -w @ts-linq/plugin-* -w @ts-linq/telemetry",
    "build:tools": "npm run build -w @ts-linq/cli -w @ts-linq/testkits -w @ts-linq/config",
    "build:all": "npm run build:foundation && npm run build:core && npm run build:providers && npm run build:extensions && npm run build:tools"
  }
}
```

## Long-term Solution: Turborepo

Already have turbo in dependencies. Add turbo.json:

```json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": []
    }
  }
}
```

Then just run:
```bash
turbo run build
```

Turbo will automatically handle dependency order and caching.

## Next Steps

1. ✅ Fix ast/tsconfig.json paths
2. ✅ Build ast package
3. ✅ Build remaining packages in order
4. ✅ Add build scripts to root package.json
5. ✅ Optional: Set up Turborepo for automatic orchestration
6. ✅ Update documentation

## Success Criteria

- ✅ All 35 packages build without errors
- ✅ `npm run build:all` works from root
- ✅ Tests can run against built packages
- ✅ No circular dependencies
- ✅ Clean dist/ folders with proper types
