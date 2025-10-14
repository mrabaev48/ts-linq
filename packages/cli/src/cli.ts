#!/usr/bin/env node
/* Minimal CLI: prints SQLite diff SQL using current metadata. */
import 'reflect-metadata';
//
import { InitCommand } from './commands/InitCommand';
import { GenerateEntityCommand } from './commands/GenerateEntityCommand';
import { GenerateEntitiesCommand } from './commands/GenerateEntitiesCommand';
import { GenerateMigrationCommand } from './commands/GenerateMigrationCommand';
import { SchemaExportCommand } from './commands/SchemaExportCommand';
import { SchemaDiffCommand } from './commands/SchemaDiffCommand';
import { SchemaApplyCommand } from './commands/SchemaApplyCommand';
import { SchemaValidateCommand } from './commands/SchemaValidateCommand';
import { MigrationsStatusCommand } from './commands/MigrationsStatusCommand';
import { MigrationsDryRunCommand } from './commands/MigrationsDryRunCommand';
import { MigrationsRollbackCommand } from './commands/MigrationsRollbackCommand';
import { MigrationsValidateCommand } from './commands/MigrationsValidateCommand';
import { SeedCommand } from './commands/SeedCommand';
import { MetricsServeCommand } from './commands/MetricsServeCommand';
//
import { CommandRegistry } from './CommandRegistry';
import type { Command, DbCommand } from './commands/Command';
import { createProviderFromEnv } from './provider-factory';

// provider-factory and config helpers are in separate modules now

async function main() {
  const argv = process.argv.slice(2);
  const cmdName = argv[0];

  const registry = new CommandRegistry([
    new InitCommand(),
    new GenerateEntityCommand(),
    new GenerateEntitiesCommand(),
    new GenerateMigrationCommand(),
    new SchemaExportCommand(),
    new SchemaDiffCommand(),
    new SchemaApplyCommand(),
    new SchemaValidateCommand(),
    new MigrationsStatusCommand(),
    new MigrationsDryRunCommand(),
    new MigrationsRollbackCommand(),
    new MigrationsValidateCommand(),
    new SeedCommand(),
    new MetricsServeCommand()
  ]);
  const command = registry.get(cmdName);
  if (!command) {
    const lines = registry
      .listCatalog()
      .map(
        (c) =>
          `  ${c.name}${c.aliases?.length ? ` (aliases: ${c.aliases.join(', ')})` : ''} - ${c.describe}`
      );
    console.error(
      `Unknown command: ${cmdName || '(none)'}\nAvailable commands:\n${lines.join('\n')}`
    );
    process.exitCode = 2;
    return;
  }

  // Determine command type: DbCommand vs Command
  const maybeDb = command as DbCommand;
  const isDbCommand = typeof maybeDb.runDb === 'function';
  if (isDbCommand) {
    const provider = createProviderFromEnv();
    try {
      await provider.connect();
      await maybeDb.runDb(provider, argv);
    } finally {
      await provider.disconnect();
    }
    return;
  }
  const simple = command as Command;
  await simple.run(argv);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
