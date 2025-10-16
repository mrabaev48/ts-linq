import type { Command } from './Command';
import type { Logger } from '../ports/Logger';
import type { FileSystem } from '../ports/FileSystem';
import { MigrationTemplateBuilder } from '../generators/MigrationTemplateBuilder';
export declare class GenerateMigrationCommand implements Command {
    private readonly logger;
    private readonly fsAdapter;
    private readonly builder;
    readonly name = "generate:migration";
    readonly describe = "Creates a migration file from a template";
    readonly aliases: string[];
    constructor(logger?: Logger, fsAdapter?: FileSystem, builder?: MigrationTemplateBuilder);
    run(argv: string[]): Promise<void>;
}
//# sourceMappingURL=GenerateMigrationCommand.d.ts.map