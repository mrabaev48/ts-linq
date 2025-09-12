import type { Command } from '../runtime/command';
import type { Flags } from '../runtime/types';
import { makeEffectiveConfig } from '../runtime/config';

export class ConfigPrintCommand implements Command {
  public async execute(_rest: string[], flags: Flags): Promise<number> {
    const effective = makeEffectiveConfig(flags);
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify(
        {
          provider: effective.provider,
          connectionString: effective.connectionString,
          migrationsDir: effective.migrationsDir,
          seedsDir: effective.seedsDir,
          entitiesGlobs: effective.entitiesGlobs,
          metrics: effective.metrics
        },
        null,
        2
      )
    );
    return 0;
  }
}


