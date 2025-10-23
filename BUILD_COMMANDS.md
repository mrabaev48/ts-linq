# Build Commands Reference

## Quick Commands

```bash
# Build all packages
pnpm run build

# Clean all build artifacts
pnpm run clean

# Run tests
pnpm run test

# Lint all code
pnpm run lint
```

## Build Individual Packages

### Core Packages
```bash
pnpm run build:types          # Type definitions
pnpm run build:metrics-safe   # Metrics helpers
pnpm run build:ast            # AST and visitors
pnpm run build:metadata       # Metadata system
pnpm run build:concurrency    # Concurrency utilities
pnpm run build:cache          # Cache layer
pnpm run build:core           # Core ORM
pnpm run build:query          # Query builder
pnpm run build:orm            # ORM layer (DbContext, DbSet)
```

### Database Providers
```bash
pnpm run build:provider-sqlite    # SQLite provider
pnpm run build:provider-postgres  # PostgreSQL provider
pnpm run build:provider-mysql     # MySQL provider
pnpm run build:provider-mssql     # MSSQL provider

# Build all providers at once
pnpm run build:providers
```

### SQL Dialects
```bash
pnpm run build:dialect-sqlite    # SQLite dialect
pnpm run build:dialect-postgres  # PostgreSQL dialect
pnpm run build:dialect-mysql     # MySQL dialect
pnpm run build:dialect-mssql     # MSSQL dialect

# Build all dialects at once
pnpm run build:dialects
```

### Cache Implementations
```bash
pnpm run build:cache-redis       # Redis cache
pnpm run build:cache-memcached   # Memcached cache
```

### Loggers
```bash
pnpm run build:composite-sql-logger        # Composite logger
pnpm run build:prometheus-sql-logger       # Prometheus logger
pnpm run build:open-telemetry-sql-logger   # OpenTelemetry logger
```

### Plugins
```bash
pnpm run build:plugin-audit         # Audit plugin
pnpm run build:plugin-multi-tenant  # Multi-tenant plugin
pnpm run build:plugin-soft-delete   # Soft delete plugin
```

### Utilities
```bash
pnpm run build:cli           # CLI tool
pnpm run build:config        # Configuration
pnpm run build:migrations    # Migration system
pnpm run build:pagination    # Pagination helpers
pnpm run build:sql-visitor   # SQL visitor
pnpm run build:telemetry     # Telemetry
pnpm run build:testkits      # Test utilities
```

### Examples & Integrations
```bash
pnpm run build:examples            # Example applications
pnpm run build:e2e-tests          # E2E tests
pnpm run build:integration-nestjs  # NestJS integration
```

## Example Commands

### Run Examples
```bash
pnpm run example:simple      # Simple usage example
pnpm run example:basic       # Basic usage
pnpm run example:advanced    # Advanced queries
pnpm run example:migrations  # Migrations example
pnpm run example:sqlite      # SQLite example
pnpm run example:postgres    # PostgreSQL example
pnpm run example:mysql       # MySQL example
pnpm run example:mssql       # MSSQL example
```

## Development Workflow

```bash
# Clean build from scratch
pnpm run clean && pnpm run build

# Build specific provider and its dependencies
pnpm run build:provider-postgres

# Build all providers
pnpm run build:providers

# Build all dialects
pnpm run build:dialects

# Format code
pnpm run format

# Check formatting
pnpm run format:check
```

## Notes

- All build commands use Turbo for caching and parallel execution
- Turbo automatically builds dependencies in the correct order
- Subsequent builds are cached for speed
- Use `--force` flag to bypass cache: `pnpm run build --force`
