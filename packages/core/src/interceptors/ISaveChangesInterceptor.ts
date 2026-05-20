import type { InterceptionResult } from './InterceptionResult';
import type { SaveChangesEventData } from './types';

// eslint-disable-next-line @typescript-eslint/naming-convention
export interface ISaveChangesInterceptor {
  savingChanges?(
    ev: SaveChangesEventData,
    result: InterceptionResult<number>
  ): InterceptionResult<number> | Promise<InterceptionResult<number>>;

  savedChanges?(ev: SaveChangesEventData, result: number): number | Promise<number>;

  saveChangesFailed?(ev: SaveChangesEventData, err: Error): void | Promise<void>;
}
