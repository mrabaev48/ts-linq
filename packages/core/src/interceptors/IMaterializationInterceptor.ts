import type { MaterializationInterceptionData } from './types';

// eslint-disable-next-line @typescript-eslint/naming-convention
export interface IMaterializationInterceptor {
  initializing?(ev: MaterializationInterceptionData, instance: object): object | Promise<object>;

  initialized?(ev: MaterializationInterceptionData, instance: object): object | Promise<object>;
}
