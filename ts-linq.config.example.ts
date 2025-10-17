import { ConfigBuilder } from '@ts-linq/config';

export default ConfigBuilder
  .postgres(process.env.DATABASE_URL || 'postgres://localhost:5432/mydb')
  .migrations({
    directory: './migrations',
    tableName: '__migrations',
    pattern: '**/*.ts',
    transactional: true
  })
  .entities('./src/entities', '**/*.entity.ts')
  .cli({
    migrationsDir: './migrations',
    entitiesDir: './src/entities',
    seedsDir: './seeds'
  })
  .logging('info', true)
  .cache(true, 'memory')
  .environment('test', {
    database: {
      provider: 'sqlite',
      connection: ':memory:'
    },
    logging: {
      level: 'debug',
      sql: true
    }
  })
  .environment('production', {
    database: {
      provider: 'postgres',
      connection: process.env.DATABASE_URL!,
      pool: {
        min: 2,
        max: 10
      }
    },
    logging: {
      level: 'error',
      sql: false
    },
    cache: {
      enabled: true,
      provider: 'redis',
      connection: process.env.REDIS_URL
    }
  })
  .build();
