import type { SqlLogger, SqlLoggerFactory } from '../types';
import { CompositeSqlLogger } from './CompositeSqlLogger';

/**
 * Factory that composes multiple SqlLoggerFactory instances and/or direct SqlLogger providers.
 * Returns a CompositeSqlLogger of all non-empty results for a given provider.
 */
export class CompositeSqlLoggerFactory implements SqlLoggerFactory {
  private readonly factories: Array<SqlLoggerFactory | undefined>;
  private readonly statics: Array<SqlLogger | undefined>;

  constructor(
    options: {
      factories?: Array<SqlLoggerFactory | undefined>;
      loggers?: Array<SqlLogger | undefined>;
    } = {}
  ) {
    this.factories = options.factories ?? [];
    this.statics = options.loggers ?? [];
  }

  create(provider: 'sqlite' | 'mysql' | 'postgresql' | 'mssql' | string): SqlLogger | undefined {
    const delegates: SqlLogger[] = [];
    for (const factory of this.factories) {
      try {
        const logger = factory?.create(provider);
        if (logger) delegates.push(logger);
      } catch {
        /* ignore factory errors */
      }
    }
    for (const staticLogger of this.statics) {
      if (staticLogger) delegates.push(staticLogger);
    }
    if (delegates.length === 0) return undefined;
    return new CompositeSqlLogger(...delegates);
  }
}
