import type { InterceptionResult } from './InterceptionResult';
import type { CommandEventData, DbCommand, DbReader } from './types';

// eslint-disable-next-line @typescript-eslint/naming-convention
export interface IDbCommandInterceptor {
  readerExecuting?(
    cmd: DbCommand,
    ev: CommandEventData
  ): InterceptionResult<DbReader> | Promise<InterceptionResult<DbReader>>;

  readerExecuted?(
    cmd: DbCommand,
    ev: CommandEventData,
    result: DbReader
  ): DbReader | Promise<DbReader>;

  nonQueryExecuting?(
    cmd: DbCommand,
    ev: CommandEventData
  ): InterceptionResult<number> | Promise<InterceptionResult<number>>;

  nonQueryExecuted?(cmd: DbCommand, ev: CommandEventData, result: number): number | Promise<number>;
}
