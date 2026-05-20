import type { ConnectionEventData } from './types';

// eslint-disable-next-line @typescript-eslint/naming-convention
export interface IDbConnectionInterceptor {
  connectionOpening?(ev: ConnectionEventData): void | Promise<void>;
  connectionOpened?(ev: ConnectionEventData): void | Promise<void>;
  connectionClosing?(ev: ConnectionEventData): void | Promise<void>;
  connectionClosed?(ev: ConnectionEventData): void | Promise<void>;
}
