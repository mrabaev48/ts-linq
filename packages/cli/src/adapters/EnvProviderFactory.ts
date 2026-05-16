import type { DatabaseProvider } from '@ts-linq/core';
import { createProviderFromEnv } from '../provider-factory';
import type { ProviderFactory } from '../ports/ProviderFactory';

export class EnvProviderFactory implements ProviderFactory {
  public async create(): Promise<DatabaseProvider> {
    return createProviderFromEnv();
  }
}
