import type { DatabaseProvider } from '@ts-linq/core';

export interface ProviderFactory {
  create(): Promise<DatabaseProvider>;
}
