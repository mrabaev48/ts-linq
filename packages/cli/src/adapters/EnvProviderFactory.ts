import type { DatabaseProvider } from '@ts-linq/core';
import { createProviderFromEnv } from '../provider-factory';
import type { ProviderFactory } from '../ports/ProviderFactory';

export class EnvProviderFactory implements ProviderFactory {
  public create(): DatabaseProvider {
    return createProviderFromEnv();
  }
}
