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
import { SeedCommand } from './commands/SeedCommand';
//
import { CommandRegistry } from './CommandRegistry';
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
    new SeedCommand()
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

  const provider = command.requiresProvider ? createProviderFromEnv() : null;
  try {
    if (provider) await provider.connect();
    await command.run(provider, argv);
  } finally {
    if (provider) await provider.disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
