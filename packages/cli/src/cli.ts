#!/usr/bin/env node
/* Minimal CLI: prints diff SQL using current metadata. */
//
//
import { CommandRegistry } from './CommandRegistry';
import type { Command, DbCommand } from './commands/Command';
import { DbContextOptimizeCommand } from './commands/DbContextOptimizeCommand';
import { GenerateEntitiesCommand } from './commands/GenerateEntitiesCommand';
import { GenerateEntityCommand } from './commands/GenerateEntityCommand';
import { GenerateMigrationCommand } from './commands/GenerateMigrationCommand';
import { InitCommand } from './commands/InitCommand';
import { MetricsServeCommand } from './commands/MetricsServeCommand';
import { MigrationsBundleCommand } from './commands/MigrationsBundleCommand';
import { MigrationsDryRunCommand } from './commands/MigrationsDryRunCommand';
import { MigrationsRollbackCommand } from './commands/MigrationsRollbackCommand';
import { MigrationsScriptCommand } from './commands/MigrationsScriptCommand';
import { MigrationsStatusCommand } from './commands/MigrationsStatusCommand';
import { MigrationsValidateCommand } from './commands/MigrationsValidateCommand';
import { ScaffoldCommand } from './commands/ScaffoldCommand';
import { SchemaApplyCommand } from './commands/SchemaApplyCommand';
import { SchemaDiffCommand } from './commands/SchemaDiffCommand';
import { SchemaExportCommand } from './commands/SchemaExportCommand';
import { SchemaValidateCommand } from './commands/SchemaValidateCommand';
import { SeedCommand } from './commands/SeedCommand';
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
    new MigrationsScriptCommand(),
    new MigrationsBundleCommand(),
    new DbContextOptimizeCommand(),
    new ScaffoldCommand(),
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
    const provider = await createProviderFromEnv();
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
