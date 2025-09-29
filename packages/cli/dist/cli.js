#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/* Minimal CLI: prints SQLite diff SQL using current metadata. */
require("reflect-metadata");
//
const InitCommand_1 = require("./commands/InitCommand");
const GenerateEntityCommand_1 = require("./commands/GenerateEntityCommand");
const GenerateEntitiesCommand_1 = require("./commands/GenerateEntitiesCommand");
const GenerateMigrationCommand_1 = require("./commands/GenerateMigrationCommand");
const SchemaExportCommand_1 = require("./commands/SchemaExportCommand");
const SchemaDiffCommand_1 = require("./commands/SchemaDiffCommand");
const SchemaApplyCommand_1 = require("./commands/SchemaApplyCommand");
const SchemaValidateCommand_1 = require("./commands/SchemaValidateCommand");
const MigrationsStatusCommand_1 = require("./commands/MigrationsStatusCommand");
const MigrationsDryRunCommand_1 = require("./commands/MigrationsDryRunCommand");
const SeedCommand_1 = require("./commands/SeedCommand");
//
const CommandRegistry_1 = require("./CommandRegistry");
const provider_factory_1 = require("./provider-factory");
// provider-factory and config helpers are in separate modules now
async function main() {
    const argv = process.argv.slice(2);
    const cmdName = argv[0];
    const registry = new CommandRegistry_1.CommandRegistry([
        new InitCommand_1.InitCommand(),
        new GenerateEntityCommand_1.GenerateEntityCommand(),
        new GenerateEntitiesCommand_1.GenerateEntitiesCommand(),
        new GenerateMigrationCommand_1.GenerateMigrationCommand(),
        new SchemaExportCommand_1.SchemaExportCommand(),
        new SchemaDiffCommand_1.SchemaDiffCommand(),
        new SchemaApplyCommand_1.SchemaApplyCommand(),
        new SchemaValidateCommand_1.SchemaValidateCommand(),
        new MigrationsStatusCommand_1.MigrationsStatusCommand(),
        new MigrationsDryRunCommand_1.MigrationsDryRunCommand(),
        new SeedCommand_1.SeedCommand()
    ]);
    const command = registry.get(cmdName);
    if (!command) {
        const lines = registry
            .listCatalog()
            .map((c) => `  ${c.name}${c.aliases?.length ? ` (aliases: ${c.aliases.join(', ')})` : ''} - ${c.describe}`);
        console.error(`Unknown command: ${cmdName || '(none)'}\nAvailable commands:\n${lines.join('\n')}`);
        process.exitCode = 2;
        return;
    }
    const provider = command.requiresProvider ? (0, provider_factory_1.createProviderFromEnv)() : null;
    try {
        if (provider)
            await provider.connect();
        await command.run(provider, argv);
    }
    finally {
        if (provider)
            await provider.disconnect();
    }
}
main().catch((err) => {
    console.error(err);
    process.exit(1);
});
//# sourceMappingURL=cli.js.map