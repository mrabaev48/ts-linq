import type { SqlLogger, SqlLoggerFactory } from '@ts-linq/types';
import { CompositeSqlLogger } from './CompositeSqlLogger';

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
    for (const f of this.factories) {
      try {
        const l = f?.create(provider);
        if (l) delegates.push(l);
      } catch {
        /* ignore */
      }
    }
    for (const s of this.statics) if (s) delegates.push(s);
    if (delegates.length === 0) return undefined;
    return new CompositeSqlLogger(...delegates);
  }
}
