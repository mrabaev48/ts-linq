# @ts-linq/config

Configuration management for ts-linq ORM.

## Installation

```bash
npm install @ts-linq/config
```

## Usage

### Create Configuration File

**ts-linq.config.ts:**
```typescript
import { ConfigBuilder } from '@ts-linq/config';

export default ConfigBuilder
  .postgres(process.env.DATABASE_URL!)
  .migrations({
    directory: './migrations',
    transactional: true
  })
  .entities('./src/entities', '**/*.entity.ts')
  .logging('info', true)
  .cache(true, 'redis')
  .environment('production', {
    logging: { level: 'error', sql: false }
  })
  .build();
```

### Load Configuration

```typescript
import { ConfigLoader } from '@ts-linq/config';

const config = await ConfigLoader.load({
  environment: 'production',
  validate: true
});

console.log(config.database.provider); // 'postgres'
```

## Configuration Options

### Database
- `provider`: 'sqlite' | 'postgres' | 'mysql' | 'mssql'
- `connection`: Connection string or object
- `pool`: Connection pool settings

### Migrations
- `directory`: Migration files directory
- `tableName`: Migrations table name
- `pattern`: File pattern to match
- `transactional`: Wrap in transaction

### Entities
- `directory`: Entity files directory
- `pattern`: File pattern to match

### CLI
- `migrationsDir`: CLI migrations directory
- `entitiesDir`: CLI entities directory
- `seedsDir`: Seed files directory

### Logging
- `level`: 'debug' | 'info' | 'warn' | 'error'
- `sql`: Log SQL queries
- `slowQueryThreshold`: Slow query threshold (ms)

### Cache
- `enabled`: Enable caching
- `provider`: 'memory' | 'redis' | 'memcached'
- `ttl`: Cache TTL (seconds)
- `connection`: Cache connection string

## Environment Overrides

```typescript
export default {
  database: {
    provider: 'sqlite',
    connection: ':memory:'
  },
  environments: {
    test: {
      database: {
        connection: ':memory:'
      }
    },
    production: {
      database: {
        provider: 'postgres',
        connection: process.env.DATABASE_URL
      },
      logging: {
        level: 'error'
      }
    }
  }
};
```

## Helper Methods

```typescript
// SQLite
ConfigBuilder.sqlite(':memory:')

// PostgreSQL
ConfigBuilder.postgres('postgres://localhost/db')

// MySQL
ConfigBuilder.mysql('mysql://localhost/db')

// MSSQL
ConfigBuilder.mssql('Server=localhost;Database=db')
```
