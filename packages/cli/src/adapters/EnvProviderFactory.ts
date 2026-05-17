import type { DatabaseProvider } from '@ts-linq/core';

import type { ProviderFactory } from '../ports/ProviderFactory';
import { createProviderFromEnv } from '../provider-factory';

export class EnvProviderFactory implements ProviderFactory {
  public async create(): Promise<DatabaseProvider> {
    return createProviderFromEnv();
  }
}
